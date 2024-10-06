const { database } = require("../services/database");

const get = async () => {
  return await database.getAll("reports", {});
};

const add = async (reportInfo) => {
  // Add a new report to the repoerts collection in the database
  const { insertedId } = await database.add("reports", reportInfo);
  // Return the ID of the report that was just added
  return { reportId: insertedId };
};

const remove = async (id, reportId) => {
  await database.remove("reports", { _id: id });
  return await database.removeMany("reports", { reportedPost: reportId });
};

module.exports = { add, get, remove };
