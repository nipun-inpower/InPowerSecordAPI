const userdb = require("../models/users.js");
const postdb = require("../models/post.js");
const constants = require("../constants");

const { ObjectId } = require("mongodb");

const get = async (req, res) => {
  try {
    const { userid } = req.user; // user ID of the profile viewer
    const { id } = req.params; // user ID of the profile being viewed

    if (!id) {
      return res.status(400).send({ msg: "Missing profile id" });
    }
    // Get the groups and following of the user viewing the profile
    const { groups, following, blockedBy, userType } = await userdb.search({
      _id: new ObjectId(userid),
    });

    if (userType !== constants.ADMIN && blockedBy.includes(id)) {
      return res
        .status(400)
        .send({ msg: "You do not have permission to view this profile" });
    }

    const profile = await userdb.search({
      _id: new ObjectId(id),
    });

    // Remove what you don't want others to see when viewing users profiles
    delete profile.password;
    delete profile.phoneNumber;
    delete profile.email;
    delete profile.selfieImageUrl;

    // Get all posts by the user being viewed and filter out the ones that the viewer can't see (Based on groups joined)
    const userPosts = await postdb.getAll({
      "author.id": id,
      isAnonymous: false.toString(),
    });

    const posts = userPosts.filter(
      (post) =>
        groups.filter((group) => post.belongsTo.includes(group)).length > 0
    );

    const followers = profile.followers.filter((follower) =>
      following.includes(follower)
    );

    const mutualFollowers = await Promise.all(
      followers.map(async (follower) => {
        const followerProfile = await userdb.search({
          _id: new ObjectId(follower),
        });
        return `${followerProfile.firstname} ${followerProfile.lastname}`;
      })
    );

    res.status(200).send({ profile, posts, mutualFollowers });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const block = async (req, res) => {
  try {
    const { userid } = req.user;
    const { id } = req.params;

    if (!id) {
      return res.status(400).send({ msg: "Missing profile id" });
    }

    if (userid === id) {
      return res.status(400).send({ msg: "Can't block yourself" });
    }

    const { blockedList, following, followers } = await userdb.search({
      _id: new ObjectId(userid),
    });

    if (blockedList.includes(id)) {
      return res.status(400).send({ msg: "User is already blocked" });
    }

    if (following.includes(id)) {
      await userdb.unFollow(new ObjectId(userid), new ObjectId(id));
    }

    if (followers.includes(id)) {
      await userdb.unFollow(new ObjectId(id), new ObjectId(userid));
    }

    await userdb.block(new ObjectId(userid), new ObjectId(id));

    res.status(200).send({ msg: "Blocked user" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const unblock = async (req, res) => {
  try {
    const { userid } = req.user;
    const { id } = req.params;

    if (!id) {
      return res.status(400).send({ msg: "Missing profile id" });
    }

    if (userid === id) {
      return res.status(400).send({ msg: "Cant un-block yourself" });
    }

    const { blockedList } = await userdb.search({
      _id: new ObjectId(userid),
    });

    if (!blockedList.includes(id)) {
      return res.status(400).send({ msg: "User is not blocked" });
    }

    await userdb.unblock(new ObjectId(userid), new ObjectId(id));

    res.status(200).send({ msg: "Un-blocked user" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const follow = async (req, res) => {
  try {
    const { userid } = req.user;
    const { id } = req.params;

    if (!id) {
      return res.status(400).send({ msg: "Missing profile id" });
    }
    if (userid === id) {
      return res.status(400).send({ msg: "Can't follow yourself" });
    }

    const { following, blockedBy, userType } = await userdb.search({
      _id: new ObjectId(userid),
    });

    if (following.includes(id)) {
      return res.status(400).send({ msg: "User is already following user" });
    }

    if (userType !== constants.ADMIN && blockedBy.includes(id)) {
      return res
        .status(400)
        .send({ msg: "You do not have permission to follow this user" });
    }

    await userdb.follow(new ObjectId(userid), new ObjectId(id));

    res.status(200).send({ msg: "Followed user" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const unFollow = async (req, res) => {
  try {
    const { userid } = req.user;
    const { id } = req.params;

    if (!id) {
      return res.status(400).send({ msg: "Missing profile id" });
    }

    if (userid === id) {
      return res.status(400).send({ msg: "Cant un-follow yourself" });
    }

    const { following } = await userdb.search({
      _id: new ObjectId(userid),
    });

    if (!following.includes(id)) {
      return res.status(400).send({ msg: "User is not following user" });
    }

    await userdb.unFollow(new ObjectId(userid), new ObjectId(id));

    res.status(200).send({ msg: "Un-followed user" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

module.exports = { get, follow, unFollow, block, unblock };
