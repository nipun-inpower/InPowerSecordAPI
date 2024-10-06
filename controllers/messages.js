const { ObjectId } = require("mongodb");
const messagesdb = require("../models/messages.js");
const userdb = require("../models/users.js");
const notificationdb = require("../models/notifications.js");
const constants = require("../constants");

const get = async (req, res) => {
  try {
    const { userid } = req.user;
    const { id } = req.params;

    if (!id) {
      return res.status(400).send({ msg: "ID is required for request" });
    }

    if (id === userid) {
      return res.status(400).send({ msg: "Cannot get messages with yourself" });
    }

    const chat = await messagesdb.get(userid, id);

    res.status(200).send({ chat });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

const create = async (req, res) => {
  try {
    const { userid } = req.user;
    const { id } = req.params; // ID of the message recipient
    const { message } = req.body;

    if (!(id && message)) {
      return res
        .status(400)
        .send({ msg: "A message with an id must be sent for the request" });
    }

    if (id === userid) {
      return res.status(400).send({ msg: "Cannot message yourself" });
    }

    const {
      firstname,
      lastname,
      profileImageUrl,
      gender,
      blockedBy,
      userType,
    } = await userdb.search({
      _id: new ObjectId(userid),
    });

    if (userType !== constants.ADMIN && blockedBy.includes(id)) {
      return res
        .status(400)
        .send({ msg: "You do not have permission to message this user." });
    }

    const author = {
      id: userid,
      firstname,
      lastname,
      profileImage: profileImageUrl,
      gender,
    };

    await messagesdb.send(userid, id, {
      message,
      author,
      createdAt: Date.now(),
    });

    // Notify the recipient that they've received a message
    await notificationdb.add(new ObjectId(id), {
      type: "message",
      message,
      author,
    });

    res.status(200).send({ msg: "Sent message" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

module.exports = { get, create };
