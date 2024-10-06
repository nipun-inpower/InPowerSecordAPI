const userdb = require("../models/users.js");
const postdb = require("../models/post.js");
const notificationdb = require("../models/notifications.js");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { uploadFiles } = require("../services/s3bucket.js");
const commentService = require("../services/getComments.js");
const { orderByDate } = require("../services/sort.js");

const { ObjectId } = require("mongodb");
const constants = require("../constants.js");

const get = async (req, res) => {
  try {
    const { userid } = req.user;

    const user = await userdb.search({ _id: new ObjectId(userid) });

    // removes info that people shouldn't have access to
    delete user.password;

    // const userPosts = await postdb.getAll({ "author.id": userid });

    // const bookmarkedPosts = await postdb.getAll({ bookmarks: userid });

    return res.status(200).send(user);
    // .send({ user, userPosts, bookmarks: bookmarkedPosts });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

//get my posts
const getMyPosts = async (req, res) => {
  try {
    const { userid } = req.user;
    const myPosts = [];

    const posts = await postdb.getAll({ "author.id": userid });
    await Promise.all(
      posts.map(async (post) => {
        // Gets and attaches the comments to the post for each post
        post.comments = await commentService.get(post.comments);
        // The main part of the functionality to avoid adding duplicate posts to the user's feed
        if (
          myPosts.length === 0 ||
          (myPosts.length > 0 &&
            myPosts.filter(
              (myFeedPost) => myFeedPost._id.toString() === post._id.toString()
            ).length === 0)
        ) {
          myPosts.push(post);
        }
      })
    );

    // Sorts the feed by the creation date using a custom sorting function
    myPosts.sort(orderByDate);

    return res.status(200).send(myPosts);
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const getMyAnonymousPosts = async (req, res) => {
  try {
    const { userid } = req.user;
    const myAnnonymousPosts = [];

    const posts = await postdb.getAll({
      "author.id": userid,
      isAnonymous: true,
    });
    await Promise.all(
      posts.map(async (post) => {
        // Gets and attaches the comments to the post for each post
        post.comments = await commentService.get(post.comments);
        // The main part of the functionality to avoid adding duplicate posts to the user's feed
        if (
          myAnnonymousPosts.length === 0 ||
          (myAnnonymousPosts.length > 0 &&
            myAnnonymousPosts.filter(
              (myFeedPost) => myFeedPost._id.toString() === post._id.toString()
            ).length === 0)
        ) {
          myAnnonymousPosts.push(post);
        }
      })
    );

    // Sorts the feed by the creation date using a custom sorting function
    myAnnonymousPosts.sort(orderByDate);
    return res.status(200).send(myAnnonymousPosts);
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

//get my bookmarks
const getMyBookmarks = async (req, res) => {
  try {
    const { userid } = req.user;
    const myBookmarks = [];

    const posts = await postdb.getAll({ bookmarks: userid });
    await Promise.all(
      posts.map(async (post) => {
        // Gets and attaches the comments to the post for each post
        post.comments = await commentService.get(post.comments);
        // The main part of the functionality to avoid adding duplicate posts to the user's feed
        if (
          myBookmarks.length === 0 ||
          (myBookmarks.length > 0 &&
            myBookmarks.filter(
              (myFeedPost) => myFeedPost._id.toString() === post._id.toString()
            ).length === 0)
        ) {
          myBookmarks.push(post);
        }
      })
    );

    // Sorts the feed by the creation date using a custom sorting function
    myBookmarks.sort(orderByDate);
    return res.status(200).send(myBookmarks);
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// excludes the current user making the request
const getAll = async (req, res) => {
  try {
    const { userid } = req.user;
    const _users = await userdb.get();

    const { blockedBy, userType } = await userdb.search({
      _id: new ObjectId(userid),
    });

    const users = _users
      .filter((user) => {
        const isNotCurrentUser = user._id.toString() !== userid;
        const isNotBlocked =
          user.userType !== constants.ADMIN
            ? !blockedBy.includes(user._id.toString())
            : true;
        return isNotCurrentUser && isNotBlocked;
      })
      .map((user) => {
        // removes info that people shouldn't have access to
        delete user.password;
        delete user.selfieImageUrl;
        delete user.verified;
        delete user.phoneNumber;
        delete user.email;
        return user;
      });

    return res.status(200).send(users);
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const login = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body; // phone number and password needed to login

    if (!(phoneNumber && password)) {
      return res
        .status(400)
        .send({ msg: "All required fields need to be entered." });
    }

    const user = await userdb.search({ phoneNumber });

    if (!(user && (await bcrypt.compare(password, user.password)))) {
      return res.status(400).send({ msg: "Invalid credentials." });
    }

    const token = jwt.sign(
      // creates a token for the user to be authenticated
      { userid: user._id, phoneNumber },
      process.env.TOKEN_KEY,
      {
        expiresIn: 86400, // 86400 = 24 hours  // or use "24h"
      }
    );

    return res
      .cookie("token", token, { httpOnly: true })
      .status(200)
      .send({ msg: "Successful login.", token: token, statusCode: 200 });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// includes required profile picture and selfie
const register = async (req, res) => {
  try {
    const {
      firstname,
      lastname,
      // username,
      password,
      gender,
      email,
      phoneNumber,
      DoB,
    } = req.body;
    const { profileImage, selfieImage } = req.files;

    if (
      !(
        firstname &&
        lastname &&
        phoneNumber &&
        password &&
        gender &&
        email &&
        DoB
      )
    ) {
      return res.status(400).send({
        msg: "All fields required filled need to be entered, including profile picture and selfie.",
      });
    }

    if (!(profileImage?.length === 1 && selfieImage?.length === 1)) {
      return res
        .status(400)
        .send({ msg: "Both profile picture and selfie must be uploaded." });
    }

    if (!(gender === "woman" || gender === "non-binary")) {
      return res
        .status(400)
        .send({ msg: "Gender must be woman or non-binary." });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/; // validates email inputted is infact an email address
    const phoneRegex = /^\+?[0-9]\d{1,14}$/; // validates phone number inputted is infact a phone number

    if (!emailRegex.test(email)) {
      return res.status(400).send({ msg: "Invalid email." });
    }

    if (!phoneRegex.test(phoneNumber)) {
      return res.status(400).send({ msg: "Invalid phone number." });
    }

    const birthDay = new Date(DoB);
    const ageDifference = Date.now() - birthDay.getTime();
    const ageDate = new Date(ageDifference);
    const age = Math.abs(ageDate.getUTCFullYear() - 1970);

    if (age < 18) {
      return res.status(400).send({ msg: "Must be 18 years or older." });
    }

    // const usernameExists = await userdb.search({ username });
    // if (usernameExists) {
    //   return res.status(409).send({ msg: "Username already in use." });
    // }

    const emailExists = await userdb.search({ email });
    if (emailExists) {
      return res.status(409).send({ msg: "Email already in use." });
    }

    const phoneNumberExists = await userdb.search({ phoneNumber });
    if (phoneNumberExists) {
      return res.status(409).send({ msg: "Phone number already in use." });
    }

    const [pfpImageUrl, selfieImageUrl] = await uploadFiles([
      ...profileImage,
      ...selfieImage,
    ]);

    if (!(pfpImageUrl && selfieImageUrl)) {
      return res
        .status(500)
        .send({ msg: "Failed to upload images. Please try again." });
    }

    const encryptedPassword = await bcrypt.hash(password, 10); // password hashed before storing for security

    const { userid } = await userdb.create({
      firstname,
      lastname,
      // username,
      email,
      password: encryptedPassword,
      gender,
      phoneNumber,
      DoB,
      createdAt: Date.now(),
      userType: constants.USER,
      verified: false,
      profileImageUrl: pfpImageUrl,
      selfieImageUrl: selfieImageUrl,
      groups: [],
      followers: [],
      following: [],
      bio: null,
      isPrivate: false,
      myBadges: [],
      blockedList: [],
      blockedBy: [],
    });

    await notificationdb.create(new ObjectId(userid.toString()));

    // Sends a notification to all Admin users that the newly registered user needs their selfie verified
    await notificationdb.sendToAdmin({
      type: "verification",
      content: "Verify user",
      author: {
        id: userid.toString(),
        firstname,
        lastname,
        // username,
        phoneNumber,
        profileImage: pfpImageUrl,
        selfieImageUrl: selfieImageUrl,
        gender,
      },
    });

    const token = jwt.sign({ userid, phoneNumber }, process.env.TOKEN_KEY, {
      expiresIn: "1h",
    });

    return res
      .cookie("token", token, { httpOnly: true })
      .status(200)
      .send({ msg: "Successfully registered.", token: token, statusCode: 200 });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// This is for Admins to verify a newly registered user's selfie
const verify = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res
        .status(400)
        .send({ msg: "User ID to verify is required for the request." });
    }

    if (id.length !== 24) {
      return res.status(400).send({ msg: "User ID must be a valid length." });
    }

    await userdb.verify(new ObjectId(id)); // Changes the newly registered user's verified attribute to true

    return res.status(200).send({ msg: "verified user" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// Gets all unverified users (this is for Admin users only)
const unverified = async (req, res) => {
  try {
    const users = await userdb.getUnverified();

    res.status(200).send({ users });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// Admins can promote other users to a higher type, i.e. Standard user -> Moderator user
const promote = async (req, res) => {
  try {
    const { id } = req.params;
    const { level } = req.body;

    if (!(id && level)) {
      return res
        .status(400)
        .send({ msg: "User id and level is required to promote user" });
    }

    const user = await userdb.search({ _id: new ObjectId(id) });

    if (user.userType >= level) {
      return res
        .status(400)
        .send({ msg: "Cannot promote user to the same or lower level" });
    }

    await userdb.updateUserType(user._id, level);

    return res
      .status(200)
      .send({ msg: `Promoted user: ${user.firstname} ${user.lastname}` });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// Admins can downgrade other users to a lower type, i.e. Moderator user -> Standard user
const downgrade = async (req, res) => {
  try {
    const { id } = req.params;
    const { level } = req.body;

    if (!(id && (level || level === 0))) {
      return res
        .status(400)
        .send({ msg: "User id and level is required to downgrade user" });
    }

    const user = await userdb.search({ _id: new ObjectId(id) });

    // Admins cannot downgrade other Admins, to prevent an Admin from 'going rogue' and downgrading all other Admins
    // while keeping Admin privileges for themselves.
    if (user.userType === constants.ADMIN) {
      return res.status(400).send({ msg: "Cannot downgrade an admin" });
    }

    if (user.userType <= level) {
      return res
        .status(400)
        .send({ msg: "Cannot downgrade user to the same or higher level" });
    }

    await userdb.updateUserType(user._id, level);

    return res
      .status(200)
      .send({ msg: `Downgraded user: ${user.firstname} ${user.lastname}` });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// This is for a user to update their bio that is displayed on their profile
const updateBio = async (req, res) => {
  try {
    const { userid } = req.user;
    const { bio } = req.body;

    if (!bio || bio.length > 150) {
      return res.status(400).send({
        msg: "Bio should not be empty and should also not be more than 150 characters.",
      });
    }

    await userdb.updateUserBio(new ObjectId(userid), bio);

    return res.status(200).send({ msg: "Updated bio" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// This is for a user to update their account private or not
const updatePrivacy = async (req, res) => {
  try {
    const { userid } = req.user;
    const { isPrivate } = req.body;

    if (isPrivate !== true && isPrivate !== false) {
      return res.status(400).send({
        msg: "Please enter true or false for private.",
      });
    }

    await userdb.updateUserPrivacy(new ObjectId(userid), isPrivate);

    return res.status(200).send({ msg: "Updated privacy" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const editProfile = async (req, res) => {
  try {
    const { userid } = req.user;
    const { firstname, lastname, gender } = req.body;
    const { profileImageUrl } = req.files?.profileImageUrl ?? {};

    if (firstname) {
      await userdb.updateUserFirstname(new ObjectId(userid), firstname);
    }

    if (lastname) {
      await userdb.updateUserLastname(new ObjectId(userid), lastname);
    }

    // Check if each field is present and add it to the updates object
    if (gender) {
      if (!(gender === "woman" || gender === "non-binary")) {
        return res
          .status(400)
          .send({ msg: "Gender must be woman or non-binary." });
      } else {
        await userdb.updateUserGender(new ObjectId(userid), gender);
      }
    }

    var pfpImageUrl = [];

    if (profileImageUrl) {
      pfpImageUrl = await uploadFiles(profileImageUrl);
      if (!pfpImageUrl) {
        console.log("Failed to upload profile image");
        // return res
        //   .status(500)
        //   .send({ msg: "Failed to upload profile image" });
      } else {
        update.profileImageUrl = pfpImageUrl[0];
        await userdb.updateUserProfileImageURL(
          new ObjectId(userid),
          pfpImageUrl[0]
        );
      }
    } else {
      console.log("No profileImage");
    }

    return res
      .status(200)
      .send({ msg: "Your profile has been updated", statusCode: 200 });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// For users to delete their account
const remove = async (req, res) => {
  try {
    const { userid } = req.user;

    const removedUser = await userdb.remove(new ObjectId(userid));

    if (removedUser.deletedCount === 0) {
      return res.status(500).send({ msg: "Failed to delete account" });
    }

    return res
      .cookie("token", "", { httpOnly: true })
      .status(200)
      .send({ msg: "Successfully deleted account" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

module.exports = {
  get,
  getMyPosts,
  getMyAnonymousPosts,
  getMyBookmarks,
  getAll,
  login,
  register,
  verify,
  unverified,
  promote,
  downgrade,
  editProfile,
  updateBio,
  updatePrivacy,
  remove,
};
