const reportdb = require("../models/report.js");
const postdb = require("../models/post.js");
const commentdb = require("../models/comment.js");

const { ObjectId } = require("mongodb");

const get = async (req, res) => {
  try {
    // Gets all reported posts/comments from the database
    const reported = await reportdb.get();

    const posts = await Promise.all(
      reported.map(async (post) => {
        // If the reported content is not found in the post collection, check the comment collection
        const reportedPost =
          (await postdb.get(new ObjectId(post.reportedPost))) ??
          (await commentdb.get(new ObjectId(post.reportedPost)));
        // Returns the post/comment along with the report information (report reason)
        return { ...post, post: reportedPost };
      })
    );

    res.status(200).send({ posts });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

module.exports = { get };
