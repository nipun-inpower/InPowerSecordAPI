const notificationdb = require("../models/notifications.js");

const { ObjectId } = require("mongodb");

const get = async (req, res) => {
  try {
    const { userid } = req.user;
    // Get the notifications for the user by their uesr ID
    const notification = await notificationdb.get(new ObjectId(userid));

    // belongsTo is not needed in the response so remove it
    delete notification.belongsTo;
    res.status(200).send( notification );
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

// For when a user wants to clear their notifications
const clear = async (req, res) => {
  try {
    const { userid } = req.user;
    await notificationdb.clear(new ObjectId(userid));
    res.status(200).send({ msg: "cleared notifications" });
  } catch (error) {
    console.error(error);
    res.status(500).send({ msg: "Internal server error." });
  }
};

module.exports = {
  get,
  clear,
};
