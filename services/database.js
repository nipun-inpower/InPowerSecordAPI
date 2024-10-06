require("dotenv").config();

const { MongoClient, ServerApiVersion } = require("mongodb");
const uriForDatabase = process.env.DB_URI;

const mongoClientSetup = new MongoClient(uriForDatabase, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true, // strict mode avoids deprecated API use
    deprecationErrors: true, // This will throw errors instead of warnings when features are deprecated
  },
});

async function connectionInitialisation() {
  try {
    await mongoClientSetup.connect();
  } catch (errors) {
    console.log(errors);
  }
}

connectionInitialisation();

const dbOperationsEndpoints = {
  async getAll(collectionName, qSearch) {
    try {
      return await mongoClientSetup
        .db(process.env.DB_NAME)
        .collection(collectionName)
        .find(qSearch)
        .toArray();
    } catch (error) {
      console.log(error);
    }
  },
  async remove(collectionName, qSearch) {
    try {
      return await mongoClientSetup
        .db(process.env.DB_NAME)
        .collection(collectionName)
        .deleteOne(qSearch);
    } catch (error) {
      console.log(error);
    }
  },
  async add(collectionName, data) {
    try {
      return await mongoClientSetup
        .db(process.env.DB_NAME)
        .collection(collectionName)
        .insertOne(data);
    } catch (error) {
      console.log(error);
    }
  },
  async update(collectionName, dataToUpdate) {
    try {
      return await mongoClientSetup
        .db(process.env.DB_NAME)
        .collection(collectionName)
        .updateOne(
          { _id: dataToUpdate.id },
          {
            $set: {
              [dataToUpdate.key]: dataToUpdate.value,
            },
          }
        );
    } catch (error) {
      console.log(error);
    }
  },
  async updateMany(collectionName, dataToUpdate) {
    try {
      return await mongoClientSetup
        .db(process.env.DB_NAME)
        .collection(collectionName)
        .updateMany(
          {},
          {
            $set: {
              [dataToUpdate.key]: dataToUpdate.value,
            },
          }
        );
    } catch (error) {
      console.log(error);
    }
  },
  async removeMany(collectionName, qSearch) {
    try {
      return await mongoClientSetup
        .db(process.env.DB_NAME)
        .collection(collectionName)
        .deleteMany(qSearch);
    } catch (error) {
      console.log(error);
    }
  },
  async get(collectionName, qSearch) {
    try {
      return await mongoClientSetup
        .db(process.env.DB_NAME)
        .collection(collectionName)
        .findOne(qSearch);
    } catch (error) {
      console.log(error);
    }
  },
  async sendPing() {
    try {
      await mongoClientSetup.db("admin").command({ ping: 1 });
      console.log("Successfully pinged.");
    } catch (error) {
      console.log(error);
    }
  },
};

module.exports.database = dbOperationsEndpoints;
