const { database } = require("../services/database");

// These are all functions that interact with the posts collection in the mongoDB database (CRUD operations)

// Gets posts that belong to a specified group
const getByGroup = async (groupid) => {
  return await database.getAll("posts", {
    belongsTo: { $eq: groupid }, // The checker that checks if the post belongs to the group
  });
};

// Gets a post by its ID
const get = async (postid) => {
  return await database.get("posts", { _id: postid });
};

const create = async (postInfo) => {
  const { insertedId } = await database.add("posts", postInfo); // Creates a new post in the database
  return { postid: insertedId }; // Returns the newly created post's post id
};

const remove = async (id) => {
  return await database.remove("posts", { _id: id });
};

// For editing the content of a post, by its ID
const update = async (id, content) => {
  return await database.update("posts", {
    id,
    key: "content",
    value: content,
  });
};

// For editing the content of a post, by its ID
const removeCommentId = async (postid, id) => {
  console.log("postId", postid);
  console.log("removeCommentId", id);

  let comments = await database.get("posts", { _id: postid });
  console.log(comments.comments);
  var newComments = comments.comments.filter((value) => !value.equals(id));

  console.log("new: ", newComments);

  return await database.update("posts", {
    id: postid,
    key: "comments",
    value: newComments,
  });

};

// Gets ALL posts in the database
const getAll = async (query) => {
  return await database.getAll("posts", query);
};

module.exports = { create, get, getByGroup, remove, update, removeCommentId, getAll };
