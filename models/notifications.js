const userdb = require("./users.js");
const postdb = require("./post.js");
const commentdb = require("./comment.js");

const constants = require("../constants");
const { database } = require("../services/database");

// These are all functions that interact with the notifications collection in the mongoDB database (CRUD operations)

const get = async (userid) => {
  return await database.get("notifications", {
    belongsTo: userid,
  });
};

const clear = async (userid) => {
  const { _id } = await get(userid);

  return await database.update("notifications", {
    id: _id,
    key: "notifications",
    value: [], // Notifications are cleared by emptying the notifications array
  });
};

const add = async (userid, notification) => {
  const { _id, notifications } = await get(userid);

  notifications.push(notification); // Notifications get pushed to the notifications array of the user

  return await database.update("notifications", {
    id: _id,
    key: "notifications",
    value: notifications,
  });
};

const create = async (userid) => {
  return await database.add("notifications", {
    belongsTo: userid,
    notifications: [],
  });
};

const sendToAdmin = async (notification) => {
  const admins = await database.getAll("users", {
    userType: constants.ADMIN, // Only sends to Admin users. E.g. when a new user registers, only Admins are notified that the new user needs verifying.
  });

  await Promise.all(
    admins.map(async (admin) => await add(admin._id, notification))
  );
};

// For notifying users when they've been tagged in a post or comment.
// const notifyUsers = async (ats, notification, id, isPost) => {
//   const { belongsTo } = isPost ? await postdb.get(id) : await commentdb.get(id); // Checks if its a post or a comment that they've been tagged in
//   await Promise.all(
//     ats.map(async (at) => {
//       const user = await userdb.search({ username: at });

//       // This is to avoid bypassing the viewing of content in groups that the tagged user has not joined
//       if (user.groups.filter((group) => belongsTo.includes(group)).length > 0) {
//         await add(user._id, notification); // Notifies the user if they are in the same group as the post or comment they've been tagged in
//       }
//     })
//   );
// };

module.exports = { get, clear, add, create, sendToAdmin /*, notifyUsers*/ };
