const userdb = require("../models/users.js");
const groupdb = require("../models/group.js");
const postdb = require("../models/post.js");
const constants = require("../constants.js");

const { ObjectId } = require("mongodb");
const { uploadFiles } = require("../services/s3bucket.js");
const commentService = require("../services/getComments.js");
const { orderByDate } = require("../services/sort.js");

// This gets the user's feed based on the groups they've joined (users must not see content from groups they're not in)
const get = async (req, res) => {
  try {
    const { userid } = req.user;

    // Searches for user by ID to get the groups they've joined
    const { groups } = await userdb.search({ _id: new ObjectId(userid) });

    const feed = [];
    // Gets all the posts from the groups the user has joined and removes duplicates (because a single post can be made to multiple groups)
    await Promise.all(
      groups.map(async (group) => {
        const posts = await postdb.getByGroup(group);
        await Promise.all(
          posts.map(async (post) => {
            // Gets and attaches the comments to the post for each post
            post.comments = await commentService.get(post.comments);
            // The main part of the functionality to avoid adding duplicate posts to the user's feed
            if (
              feed.length === 0 ||
              (feed.length > 0 &&
                feed.filter(
                  (feedPost) => feedPost._id.toString() === post._id.toString()
                ).length === 0)
            ) {
              feed.push(post);
            }
          })
        );
        return posts;
      })
    );

    // Sorts the feed by the creation date using a custom sorting function
    feed.sort(orderByDate);

    return res.status(200).send(feed);
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// Gets ALL groups from the database
const getAll = async (req, res) => {
  try {
    const groups = await groupdb.getAll();
    res.status(200).send(groups);
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// When creating a group, users must provide a name, description, and image for the group. They also automatically join the group upon creation
const create = async (req, res) => {
  try {
    const { userid } = req.user;

    const { name, description, isPrivate, category, questions, requiredBadges } = req.body;
    const { image } = req.files;

    if (!(name && description)) {
      return res.status(400).send({
        msg: "All of the required fields must be entered to create a group.",
      });
    }

    if (image?.length !== 1) {
      return res.status(400).send({ msg: "Group image is required." });
    }

    if (await groupdb.exist(name)) {
      return res
        .status(409)
        .send({ msg: "Group already exists, try joining it." });
    }

    const [groupPicture] = await uploadFiles(image);

    if (!groupPicture) {
      return res
        .status(500)
        .send({ msg: "Failed to upload images. Please try again." });
    }

    // Set default values for optional fields
    const groupData = {
      name,
      description,
      groupPicture,
      userCount: 0,
      createdAt: Date.now(),
      createdBy: userid,
      category,
      isPrivate,
      members: [],
    };

    // Add optional fields if they exist
    if (questions) groupData.questions = questions;
    if (requiredBadges) groupData.requiredBadges = requiredBadges;

    // Create the group
    const { groupid } = await groupdb.create(groupData);

    const { modifiedCount } = await groupdb.join(new ObjectId(userid), groupid);

    if (!modifiedCount > 0) {
      return res
        .status(500)
        .send({ msg: "Failed to update user & group info." });
    }

    return res.status(200).send({ msg: "Successfully created group" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { userid } = req.user;
    const { id: groupid } = req.params;

    const group = (await groupdb.search([groupid]))?.[0];

    if (!group) {
      return res.status(404).send({ msg: "Group does not exist" });
    }

    const { createdBy } = group;

    const { userType } = await userdb.search({ _id: new ObjectId(userid) });

    const posts = await postdb.getByGroup(groupid);

    if (userid !== createdBy.toString() && userType < constants.MODERATOR) {
      return res.status(403).send({ msg: "Unauthorized" });
    }

    await Promise.all(
      posts.map(async (post) => {
        try {
          await postdb.remove(new ObjectId(post._id));
        } catch (error) {
          console.error(`Failed to delete post with ID ${post._id}:`, error);
        }
      })
    );

    await groupdb.deleteGroup(new ObjectId(groupid));

    return res
      .status(200)
      .send({ msg: "Group and associated posts deleted successfully." });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const join = async (req, res) => {
  try {
    const { userid } = req.user;
    const { id: groupid } = req.params;

    const { groups } = await userdb.search({ _id: new ObjectId(userid) });

    if (groups.includes(groupid)) {
      return res
        .status(409)
        .send({ msg: "User has already joined this group", statusCode: 409 });
    }

    const group = (await groupdb.search([groupid]))?.[0];

    if (!group) {
      res.status(400).send({ msg: "Group does not exist" });
    }

    await groupdb.join(new ObjectId(userid), new ObjectId(groupid));

    return res.status(200).send({ msg: "User successfully joined the group", statusCode: 200 });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const leave = async (req, res) => {
  try {
    const { userid } = req.user;
    const { id: groupid } = req.params;

    const { groups } = await userdb.search({ _id: new ObjectId(userid) });

    if (!groups.includes(groupid)) {
      return res
        .status(409)
        .send({ msg: "User does not belong to this group" });
    }

    const group = (await groupdb.search([groupid]))?.[0];

    if (!group) {
      res.status(400).send({ msg: "Group does not exist" });
    }

    await groupdb.leave(new ObjectId(userid), new ObjectId(groupid));

    return res.status(200).send({ msg: "User successfully left the group", statusCode: 200 });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

module.exports = {
  get,
  getAll,
  create,
  join,
  deleteGroup,
  leave,
};
