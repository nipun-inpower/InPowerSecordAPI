const { database } = require("../services/database.js");

// These are all functions that interact with the user collection in the mongoDB database (CRUD operations)

const search = async (query) => {
  return await database.get("users", query);
};

const create = async (userInfo) => {
  const { insertedId } = await database.add("users", userInfo);
  return { userid: insertedId }; // Returns the newly created user's user id
};

// For when Admins verify a newly registered user's selfie
const verify = async (id) => {
  return await database.update("users", {
    id: id,
    key: "verified",
    value: true, // changes the verified attribute (key) to true
  });
};

// For Admins to promote other users to a higher type, i.e. Standard user -> Moderator user
const updateUserType = async (id, level) => {
  return await database.update("users", { id, key: "userType", value: level });
};

// For a user to update their profile
const updateUserFirstname = async (id, firstname) => {
  return await database.update("users", {id, key: "firstname", value: firstname});
};
const updateUserLastname = async (id, lastname) => {
  return await database.update("users", {id, key: "lastname", value: lastname});
};
const updateUserGender = async (id, gender) => {
  return await database.update("users", {id, key: "gender", value: gender });
};
const updateUserProfileImageURL = async (id, pfpImageUrl) => {
  return await database.update("users", {id, key: "profileImageUrl", value: pfpImageUrl});
};

// For a user to update their bio that is displayed on their profile
const updateUserBio = async (id, bio) => {
  return await database.update("users", { id, key: "bio", value: bio });
};

// For a user to update their bio that is displayed on their profile
const updateUserPrivacy = async (id, isPrivate) => {
  return await database.update("users", {
    id,
    key: "isPrivate",
    value: isPrivate,
  });
};

// Gets ALL users in the database
const get = async () => {
  return await database.getAll("users", {});
};

// Gets ALL unverified users (this is for Admin users only)
const getUnverified = async () => {
  return (await database.getAll("users", { verified: false })).map((user) => ({
    id: user._id,
    firstname: user.firstname,
    lastname: user.lastname,
    //username: user.username,
    gender: user.gender,
    userType: user.userType,
    createdAt: user.createdAt,
    profileImageUrl: user.profileImageUrl,
    selfieImageUrl: user.selfieImageUrl,
    verified: user.verified,
  }));
};

const block = async (user, toBlockUser) => {
  const { blockedList } = await search({
    _id: user,
  });
  blockedList.push(toBlockUser.toString());

  await database.update("users", {
    id: user,
    key: "blockedList",
    value: blockedList,
  });

  const { blockedBy } = await search({
    _id: toBlockUser,
  });
  blockedBy.push(user.toString());

  return await database.update("users", {
    id: toBlockUser,
    key: "blockedBy",
    value: blockedBy,
  });
};

const unblock = async (user, toUnblockUser) => {
  const { blockedList } = await search({
    _id: user,
  });

  blockedList.splice(
    blockedList.findIndex((value) => value === toUnblockUser.toString()),
    1
  );

  await database.update("users", {
    id: user,
    key: "blockedList",
    value: blockedList,
  });

  const { blockedBy } = await search({
    _id: toUnblockUser,
  });

  blockedBy.splice(
    blockedBy.findIndex((value) => value === user.toString()),
    1
  );

  return await database.update("users", {
    id: toUnblockUser,
    key: "blockedBy",
    value: blockedBy,
  });
};

// This follows the desired user, and then also update's the followers list of the user that has just been followed to add the new follower
const follow = async (user, toFollowUser) => {
  const { following } = await search({
    _id: user,
  });
  following.push(toFollowUser.toString());

  await database.update("users", {
    id: user,
    key: "following",
    value: following,
  });

  const { followers } = await search({
    _id: toFollowUser,
  });

  followers.push(user.toString());

  return await database.update("users", {
    id: toFollowUser,
    key: "followers",
    value: followers,
  });
};

// This unfollows the desired user, and then also update's the followers list of the user that has just been unfollowed to remove the new unfollower
const unFollow = async (user, toUnFollowUser) => {
  const { following } = await search({
    _id: user,
  });

  following.splice(
    following.findIndex((value) => value === toUnFollowUser.toString()),
    1
  );

  await database.update("users", {
    id: user,
    key: "following",
    value: following,
  });

  const { followers } = await search({
    _id: toUnFollowUser,
  });

  followers.splice(
    following.findIndex((value) => value === user.toString()),
    1
  );

  return await database.update("users", {
    id: toUnFollowUser,
    key: "followers",
    value: followers,
  });
};

// This is for when a user deletes their account (it removes the user from the database)
const remove = async (userid) => {
  return await database.remove("users", { _id: userid });
};

module.exports = {
  create,
  search,
  verify,
  get,
  getUnverified,
  block,
  unblock,
  follow,
  unFollow,
  updateUserType,
  updateUserFirstname,
  updateUserLastname,
  updateUserGender,
  updateUserProfileImageURL,
  updateUserBio,
  updateUserPrivacy,
  remove,
};
