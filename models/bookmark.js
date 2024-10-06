const { database } = require("../services/database");
const postdb = require("./post.js");
const { ObjectId } = require("mongodb");

const addBookmark = async (postid, userid) => {
  const post = await database.get("posts", { _id: new ObjectId(postid) });

  if (!post) {
    throw new Error(`Post with ID ${postid} not found.`);
  }

  const { bookmarks } = post;

  if (bookmarks.includes(userid)) {
    return;
  }

  bookmarks.push(userid);

  return await database.update("posts", {
    id: postid,
    key: "bookmarks",
    value: bookmarks,
  });
};

const removeBookmark = async (postid, userid) => {
  // First get the already existing bookmarks of the post from the database
  const { bookmarks } = await database.get("posts", {
    _id: postid,
  });

  // If the user has not bookmarked the post, do nothing
  if (!bookmarks.includes(userid)) {
    return;
  }

  // Remove the user's userId from the array of bookmarks
  bookmarks.splice(
    bookmarks.findIndex((value) => value === userid),
    1
  );

  return await database.update("posts", {
    id: postid,
    key: `bookmarks`,
    value: bookmarks,
  });
};

const getAll = async (query) => {
  return await database.getAll("bookmarks", query);
};

module.exports = {
  addBookmark,
  removeBookmark,
  getAll,
};
