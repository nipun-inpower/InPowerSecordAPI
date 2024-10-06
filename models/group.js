const { ObjectId } = require("mongodb");
const { database } = require("../services/database.js");

// These are all functions that interact with the groups collection in the mongoDB database (CRUD operations)

const search = async (groupsID) => {
  const groups = [];

  await Promise.all(
    groupsID.map(async (id) => {
      groups.push(await database.get("groups", { _id: new ObjectId(id) }));
    })
  );

  return groups;
};

const getAll = async () => {
  return await database.getAll("groups", {});
};

const exist = async (name) => {
  const group = await database.get("groups", { name });

  // '!!' converts the object to a boolean (true if the object exists and false if it doesn't)
  return !!group;
};

const create = async (groupInfo) => {
  const { insertedId } = await database.add("groups", groupInfo);
  return { groupid: insertedId };
};

const join = async (userid, groupid) => {
  const { groups } = await database.get("users", {
    _id: userid,
  });
  groups.push(groupid.toString());

  const { modifiedCount } = await database.update("users", {
    id: userid,
    key: "groups",
    value: groups,
  });

  if (modifiedCount > 0) {
    const { userCount, members: groupMembers } = (
      await search([groupid.toString()])
    )[0];

    const members = Array.isArray(groupMembers) ? groupMembers : [];

    members.push(userid);

    await database.update("groups", {
      id: groupid,
      key: "userCount",
      value: userCount + 1,
    });

    return await database.update("groups", {
      id: groupid,
      key: "members",
      value: members,
    });
  }

  return { modifiedCount: 0 };
};

const deleteGroup = async (groupid) => {
  return await database.remove("groups", { _id: groupid });
};

const leave = async (userid, groupid) => {
  const { groups } = await database.get("users", {
    _id: userid,
  });
  groups.splice(
    groups.findIndex((group) => group === groupid.toString()),
    1
  );
  const { modifiedCount } = await database.update("users", {
    id: userid,
    key: "groups",
    value: groups,
  });

  if (modifiedCount > 0) {
    const { userCount } = (await search([groupid.toString()]))[0];

    return await database.update("groups", {
      id: groupid,
      key: "userCount",
      value: userCount - 1,
    });
  }

  return { modifiedCount: 0 };
};

module.exports = {
  search,
  getAll,
  create,
  exist,
  join,
  deleteGroup,
  leave,
};
