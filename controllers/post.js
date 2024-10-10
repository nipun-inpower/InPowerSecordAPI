const userdb = require("../models/users.js");
const postdb = require("../models/post.js");
const commentdb = require("../models/comment.js");
const reactiondb = require("../models/reaction.js");
const bookmarkdb = require("../models/bookmark.js");
const notificationdb = require("../models/notifications.js");
const reportdb = require("../models/report.js");

const commentService = require("../services/getComments.js");

const { ObjectId } = require("mongodb");
const { uploadFiles } = require("../services/s3bucket.js");
const constants = require("../constants.js");
const { is } = require("express/lib/request.js");

// Get all posts from a group that the user is in
const get = async (req, res) => {
  try {
    const { userid } = req.user;
    const { groupid } = req.params;

    if (!groupid) {
      return res.status(400).send({ msg: "Group ID is required." });
    }

    // Get the groups the user is in
    const { groups, blockedBy, userType } = await userdb.search({
      _id: new ObjectId(userid),
    });

    // If the above doesnt include the groupid from the request params, then the user doesn't have access to the group because they haven't joined it
    if (!groups.includes(groupid.toString())) { 
      return res
        .status(403)
        .send({ msg: "User does not have access to this group" });
    }

    // Get posts based off the group ID and then add comments to each post
    const posts = await postdb.getByGroup(groupid);
    const blockedByAuthor = posts.filter((post) =>
      blockedBy.includes(post.author.id)
    );

    console.log("constants.ADMIN: ", constants.USER);

    if (userType !== constants.USER && blockedByAuthor) {
      return res
        .status(403)
        .send({ msg: "You do not have permission to view this post." });
    }

    const postWithComments = await Promise.all(
      posts.map(async (post) => ({
        ...post,
        comments: await commentService.get(post.comments),
      }))
    );

    const blockedByCommentor = postWithComments.map((post) => {
      post.comments.filter((comment) => blockedBy.includes(comment.author.id));
    });

    if (userType !== constants.USER && blockedByCommentor) {
      return res
        .status(403)
        .send({ msg: "You do not have permission to view this comment." });
    }

    res.status(200).send( postWithComments );
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// Creates a new post in the specified group(s)
const create = async (req, res) => {
  try {
    const { userid } = req.user;
    const { title, content, groupids, isAnonymous, warning } = req.body;
    const files = req.files;

    var newGroupIds;

    if (Array.isArray(groupids)) {
      newGroupIds = groupids;
    } else {
      newGroupIds = [groupids];
    }

    if (newGroupIds.length === 0) {
      return res.status(400).send({ msg: "At least 1 group ID is required" });
    }

    let images = [];

    if (files) {
      images = await uploadFiles(files);
    }

    if (!title && !content && images.length === 0) {
      res.status(400).send({
        msg: "At least a title, content, or image, must be provided.",
      });
    }

    const { groups, firstname, lastname, profileImageUrl, gender } =
      await userdb.search({ _id: new ObjectId(userid) });

    if (
      !(
        groups.length > 0 &&
        groups.length >= newGroupIds.length 
        &&
        newGroupIds.every((groupid) => groups.includes(groupid))
      )
    ) {
      return res
        .status(403)
        .send({ msg: "User must be in all selected group to create a post" });
    }

    var anonymous;  
    var isWarning;

    if (isAnonymous === "true"){
      anonymous = true;
    } else {
      anonymous = false;
    }

    if (warning === "true"){  
      isWarning = true;
    } else {
      isWarning = false;
    }

    // For allowing users to make anonymous posts if they so choose
    const anonymousFlag = isAnonymous === true || isAnonymous === "true";

    // If the user does infact want to make the post anonymously, hide their identity. However, don't remove their user ID, so that
    // If an Administrator or Moderator needs to, they can still identify the user i.e. when receiving reports
    const author = anonymousFlag
      ? {
          id: userid,
          firstname: "Anonymous",
          lastname: "",
          // username: "anonymous",
          profileImageUrl: "",
          gender,
        }
      : {
          id: userid,
          firstname,
          lastname,
          profileImageUrl: profileImageUrl,
          gender,
        };

    const { postid } = await postdb.create({
      belongsTo: newGroupIds,
      author,
      title: title || "",
      content: content || "",
      images,
      isAnonymous: anonymous,
      warning: isWarning,
      createdAt: Date.now(),
      reactions: {
        like: [],
        love: [],
        laugh: [],
      },
      comments: [],
      bookmarks: [],
    });

    // Parse the content to identify any tags (i.e., @username) and notify the user(s) that were tagged
    // regex = /@([a-zA-Z0-9]+)/g;
    // const ats = [...content.matchAll(regex)].map((at) => at[1]);
    // await notificationdb.notifyUsers(
    //   ats,
    //   {
    //     type: "mention",
    //     content,
    //     author,
    //   },
    //   new ObjectId(postid.toString()),
    //   true
    // );

    return res.status(200).send({ msg: "Created post", statusCode: 200 });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// For a user to edit their own post or comment
const edit = async (req, res) => {
  try {
    const { userid } = req.user;
    const { id } = req.params;
    const { message } = req.body;

    if (!(id && message)) {
      return res
        .status(400)
        .send({ msg: "Post/comment id & new message is required" });
    }

    let isPost = true;
    let editItem = await postdb.get(new ObjectId(id));

    if (!editItem) {
      isPost = false;
      editItem = await commentdb.get(new ObjectId(id));
    }

    if (!editItem) {
      return res.status(400).send({ msg: "Unable to find post/comment ID" });
    }

    // If the user isn't the author of the post/comment, they can't edit it
    if (editItem.author.id.toString() !== userid) {
      return res.status(400).send({
        msg: "Only the author of the post/comment can edit the post.",
      });
    }

    // If the content to be edited is a post, update the post. Otherwise, it's a comment, so update the comment
    if (isPost) {
      await postdb.update(new ObjectId(id), message);
    } else {
      await commentdb.update(new ObjectId(id), message);
    }

    return res.status(200).send({ msg: "Successfully updated message" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const comment = async (req, res) => {
  try {
    const { userid } = req.user;
    const { content } = req.body;
    const { id } = req.params;

    if (!(id && content)) {
      return res
        .status(400)
        .send({ msg: "All fields are required to be entered." });
    }

    // Get the user's information and check if they belong to the group(s) that the post is in
    const { groups, firstname, lastname, profileImageUrl, gender } =
      await userdb.search({ _id: new ObjectId(userid) });
    const post = await postdb.get(new ObjectId(id));

    if (!groups.filter((group) => post.belongsTo.includes(group)).length > 0) {
      return res.status(403).send({
        msg: "User doesn't belong to any of the groups that this post is in",
      });
    }

    const author = {
      id: userid,
      firstname,
      lastname,
      profileImageUrl: profileImageUrl,
      gender,
    };

    // Create the comment
    const { commentid } = await commentdb.create(
      { id: new ObjectId(id), type: "comment" },
      {
        content,
        author,
        reactions: {
          like: [],
          love: [],
          laugh: [],
        },
        comments: [],
        createdAt: Date.now(),
      }
    );

    // Parse the content to identify any tags (i.e., @username) and notify the user(s) that were tagged
    // regex = /@([a-zA-Z0-9]+)/g;
    // const ats = [...content.matchAll(regex)].map((at) => at[1]);
    // await notificationdb.notifyUsers(
    //   ats,
    //   {
    //     type: "mention",
    //     content,
    //     author,
    //   },
    //   new ObjectId(commentid.toString()),
    //   false
    // );

    // Notify the author of the post that a comment has been made on their post
    await notificationdb.add(new ObjectId(post.author.id), {
      type: "comment",
      content,
      author,
    });

    res.status(200).send({ msg: "commented" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const reply = async (req, res) => {
  try {
    const { userid } = req.user;
    const { content } = req.body;
    const { postid, id } = req.params;

    if (!(id && postid && content)) {
      return res
        .status(400)
        .send({ msg: "All fields are required to be entered." });
    }

    // Check the user belongs to the group(s) that the post is in (to be able to comment on it)
    const { groups, firstname, lastname, profileImageUrl, gender } =
      await userdb.search({ _id: new ObjectId(userid) });

    const post = await postdb.get(new ObjectId(postid));

    if (!groups.filter((group) => post.belongsTo.includes(group)).length > 0) {
      return res.status(403).send({
        msg: "User doesn't belong to any of the groups that this post is in",
      });
    }

    // Check that the user is replying to a comment that actually exists
    const comment = await commentdb.get(new ObjectId(id));

    if (!comment) {
      return res.status(400).send({ msg: "Comment doesn't exist." });
    }

    const author = {
      id: userid,
      firstname,
      lastname,
      profileImageUrl: profileImageUrl,
      gender,
    };

    // Replies are just nested comments
    const { commentid } = await commentdb.create(
      { id: new ObjectId(id), type: "reply" },
      {
        content,
        author,
        reactions: {
          like: [],
          love: [],
          laugh: [],
        },
        comments: [],
        createdAt: Date.now(),
      }
    );

    // Parse to check if the content contains any tags (i.e., @username) and notify the user(s) that were tagged
    // regex = /@([a-zA-Z0-9]+)/g;
    // const ats = [...content.matchAll(regex)].map((at) => at[1]);
    // await notificationdb.notifyUsers(
    //   ats,
    //   {
    //     type: "mention",
    //     content,
    //     author,
    //   },
    //   new ObjectId(commentid.toString()),
    //   false
    // );

    await notificationdb.add(new ObjectId(comment.author.id), {
      type: "reply",
      content,
      author,
    });

    res.status(200).send({ msg: "commented" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const reaction = async (req, res) => {
  try {
    const { userid } = req.user;
    const { reaction } = req.body;
    const { postid, id } = req.params;

    if (!(postid && reaction)) {
      return res
        .status(400)
        .send({ msg: "All fields are required to be entered." });
    }

    // There are three reactions to choose from
    if (!(reaction === "love" || reaction === "like" || reaction === "laugh")) {
      return res
        .status(400)
        .send({ msg: "invalid reaction format, must be like, love or laugh." });
    }

    const { groups } = await userdb.search({ _id: new ObjectId(userid) });
    const post = await postdb.get(new ObjectId(postid));

    if (!post) {
      return res.status(400).send({ msg: "Failed to find post" });
    }

    if (!groups.filter((group) => post.belongsTo.includes(group)).length > 0) {
      return res.status(403).send({
        msg: "User doesn't belong to any of the groups that this post is in",
      });
    }

    let reactions;
    if (id) {
      reactions = (await commentdb.get(new ObjectId(id))).reactions;
    } else {
      reactions = post.reactions;
    }

    // Check if the user has already reacted to the post/comment
    const hasReacted = Object.keys(reactions)
      .map((key) => reactions[key].includes(userid))
      .includes(true);

    // Users can only have one type of reaction to a post or comment, so this updates the reaction if they've already reacted
    const differentReaction = !Object.keys(reactions)
      .map((key) => {
        return reactions[key].includes(userid) && key === reaction;
      })
      .includes(true);

    if (hasReacted && !differentReaction) {
      return res.status(400).send({ msg: "you have already reacted" });
    }

    // Add or update the reaction
    await reactiondb.add(
      !id ? new ObjectId(postid) : new ObjectId(id),
      reaction,
      !id,
      userid,
      differentReaction
    );

    // To notify the author of the post/comment that a reaction has been made
    const author = await userdb.search({
      _id: new ObjectId(
        id ? (await commentdb.get(new ObjectId(id))).author.id : post.author.id
      ),
    });

    await notificationdb.add(
      !id
        ? new ObjectId(post.author.id)
        : new ObjectId((await commentdb.get(new ObjectId(id))).author.id),
      {
        type: "reaction",
        content: reaction,
        author: {
          id: author._id.toString,
          firstname: author.firstname,
          lastname: author.lastname,
          profileImage: author.profileImageUrl,
          gender: author.gender,
        },
      }
    );

    await res.status(200).send({ msg: "reaction added" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const bookmark = async (req, res) => {
  try {
    const { userid } = req.user;
    const { postid } = req.params;

    if (!postid) {
      return res.status(400).send({ msg: "postID required." });
    }

    const postIdObject = new ObjectId(postid);

    const { groups } = await userdb.search({ _id: new ObjectId(userid) });
    const post = await postdb.get(postIdObject);

    if (!post) {
      return res.status(400).send({ msg: "Failed to find post" });
    }

    if (!groups.filter((group) => post.belongsTo.includes(group)).length > 0) {
      return res.status(403).send({
        msg: "User doesn't belong to any of the groups that this post is in",
      });
    }

    let bookmarks = post.bookmarks;

    const hasBookmarked = bookmarks.includes(userid);

    if (hasBookmarked) {
      const removeResult = await bookmarkdb.removeBookmark(
        postIdObject,
        userid
      );
      if (removeResult.modifiedCount === 1) {
        return res.status(200).send({ msg: "Bookmark removed.", statusCode: 200 });
      } else {
        return res.status(500).send({ msg: "Failed to remove bookmark." });
      }
    } else {
      const addResult = await bookmarkdb.addBookmark(postIdObject, userid);
      if (addResult.modifiedCount === 1) {
        return res.status(200).send({ msg: "Bookmark added.", statusCode: 200  });
      } else {
        return res.status(500).send({ msg: "Failed to add bookmark." });
      }
    }
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const report = async (req, res) => {
  try {
    const { userid } = req.user;
    const { reason } = req.body;
    const { postid, id } = req.params;

    if (!(postid && reason)) {
      return res
        .status(400)
        .send({ msg: "All fields are required to be entered." });
    }

    const { groups, userType, firstname, lastname, profileImageUrl, gender } =
      await userdb.search({
        _id: new ObjectId(userid),
      });
    const post = await postdb.get(new ObjectId(postid));

    if (!post) {
      return res.status(400).send({ msg: "Failed to find post" });
    }

    if (!groups.filter((group) => post.belongsTo.includes(group)).length > 0) {
      return res.status(403).send({
        msg: "User doesn't belong to any of the groups that this post is in",
      });
    }

    // Moderators and Admins have different report functionality, whatever they 'report' gets removed immediately,
    // Instead of the report being sent to Administrator users for manual review.
    if (!userType >= constants.MODERATOR) {
      await reportdb.add({
        reportedPost: !id ? postid : id,
        reason,
      });

      await notificationdb.sendToAdmin({
        type: "Report",
        content: reason,
        author: {
          id: userid,
          firstname,
          lastname,
          profileImage: profileImageUrl,
          gender,
        },
      });

      return res.status(200).send({ msg: "Post successfully reported" });
    }

    if (id) {
      await commentdb.remove(new ObjectId(id));

      return res.status(200).send({ msg: "Comment successfully removed." });
    }

    await postdb.remove(new ObjectId(postid));

    res.status(200).send({ msg: "Post successfully removed" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const remove = async (req, res) => {
  try {
    const { userid } = req.user;
    const { postid, id } = req.params;

    if (!postid) {
      return res.status(400).send({ msg: "Post ID is required." });
    }

    const { groups, userType } = await userdb.search({
      _id: new ObjectId(userid),
    });
    const post = await postdb.get(new ObjectId(postid));

    if (!post) {
      return res.status(400).send({ msg: "Failed to find post" });
    }

    if (!groups.filter((group) => post.belongsTo.includes(group)).length > 0) {
      return res.status(403).send({
        msg: "User doesn't belong to any of the groups that this post is in",
      });
    }

    if (post.author.toString() === userid || userType >= constants.MODERATOR) {
      await postdb.remove(new ObjectId(postid));
      return res.status(200).send({ msg: "post deleted successfully." });
    }

    // Get all the reports linked to the post or comment
    const reported = await reportdb.get();

    await Promise.all(
      reported.map(async (report) => {
        if (
          (report.reportedPost === postid && !id) ||
          (!!id && report.reportedPost === id)
        ) {
          await reportdb.remove(report._id, id ? id : postid);
        }
        return report;
      })
    );

    if (id) {

      // Remove comment ID from post's comment section
      await postdb.removeCommentId(new ObjectId(postid), new ObjectId(id));

      // REmove comment from database
      await commentdb.remove(new ObjectId(id));

      return res.status(200).send({ msg: "Comment successfully removed." });
    }

    await postdb.remove(new ObjectId(postid));

    res.status(200).send({ msg: "Post successfully removed." });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

module.exports = {
  get,
  create,
  edit,
  comment,
  reply,
  reaction,
  bookmark,
  remove,
  report,
};
