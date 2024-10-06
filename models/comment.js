const postdb = require("./post.js");

const { database } = require("../services/database");

// These are all functions that interact with the comments collection in the mongoDB database (CRUD operations)

const get = async (id) => {
  return await database.get("comments", { _id: id });
};

// This is for when a user comments on a post or as a reply to another comment
// Updates the post or comment that was commented on with the new comment's ID
const create = async ({ id, type }, commentInfo) => {
  const { insertedId } = await database.add("comments", commentInfo);

  const { comments } =
    type === "comment" ? await postdb.get(id) : await get(id);

  comments.push(insertedId);

  await database.update(type === "comment" ? "posts" : "comments", {
    id: id,
    key: "comments",
    value: comments,
  });
  return { commentid: insertedId };
};

// For users to edit a comment they've made
const update = async (id, content) => {
  return await database.update("comments", {
    id,
    key: "content",
    value: content,
  });
};

const remove = async (id) => {
  return await database.remove("comments", { _id: id });
};

module.exports = {
  create,
  get,
  remove,
  update,
};
