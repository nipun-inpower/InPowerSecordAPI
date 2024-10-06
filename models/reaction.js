const { database } = require("../services/database");

// These are all functions that interact with the reports collection in the mongoDB database (CRUD operations)

const add = async (id, type, isPost, userid, differentReaction) => {
  // First get the already existing reactions of the post or comment from the database
  const { reactions } = await database.get(isPost ? "posts" : "comments", {
    _id: id,
  });

  // If the user has already reacted to the post or comment, remove their reaction and replace it with the new reaction
  // by removing their userid from the array of the old reaction and adding it to the new reaction
  if (differentReaction) {
    Object.keys(reactions).forEach((key) => {
      if (reactions[key].includes(userid)) {
        reactions[key].splice(
          reactions[key].findIndex((value) => value === userid),
          1
        );
      }
    });
  }

  // Push the user's userid to the array of the new reaction
  reactions[type].push(userid);

  return await database.update(isPost ? "posts" : "comments", {
    id: id,
    key: `reactions`,
    value: reactions,
  });
};

const remove = async (id, type, isPost) => {
  // First get the already existing reactions of the post or comment from the database
  const { reaction } = await database.get(isPost ? "posts" : "comments", {
    _id: id,
  });

  // Remove the user's userid from the array of the reaction and decrease the reaction count by 1
  // and update the database with the new reaction count following decrement
  return await database.update(isPost ? "posts" : "comments", {
    id: id,
    key: `reaction.${type}`,
    value: reaction[type] - 1,
  });
};

module.exports = { add, remove };
