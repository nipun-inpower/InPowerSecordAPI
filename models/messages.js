const { database } = require("../services/database");

// These are all functions that interact with the notifications collection in the mongoDB database (CRUD operations)

// This gets all chat messages between two users (which is what a room is)
const get = async (userid, id) => {
  let chats = await database.getAll("messages", {
    roomid: userid + id,
  });
  // If no chat is found, reverse the order of the IDs in case the room was created in the opposite order
  if (chats.length === 0) {
    chats = await database.getAll("messages", {
      roomid: id + userid,
    });
  }

  return chats;
};

const send = async (userid, id, message) => {
  // Check if a room already exists between the two users
  let chat = await database.getAll("messages", {
    roomid: userid + id,
  });

  // If no chat is found, reverse the order of the IDs in case the room was created in the opposite order
  if (chat.length === 0) {
    chat = await database.getAll("messages", {
      roomid: id + userid,
    });
  }

  // If no chat is found, create a new room
  if (chat.length === 0) {
    message.roomid = userid + id;
    return await database.add("messages", message);
  }

  // If there was a chat found, add the message to the existing room
  message.roomid = chat[0].roomid;
  return await database.add("messages", message);
};

module.exports = { get, send };
