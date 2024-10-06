const commentdb = require("../models/comment.js");

// Gets comments by their id, and also included replies to said comment if there are any (i.e. nested comments)
const get = async (commentsid) => {
  const comments = await Promise.all(
    commentsid.map(async (commentid) => {
      const comment = await commentdb.get(commentid);
      if (comment.comments.length > 0) {
        comment.comments = await get(comment.comments);
      }
      return comment;
    })
  );
  return comments;
};

module.exports = {
  get,
};
