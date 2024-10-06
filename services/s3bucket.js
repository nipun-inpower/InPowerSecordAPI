// s3 bucket setup
const AWS = require("aws-sdk");
const fs = require("fs");

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const s3 = new AWS.S3({
  endpoint: "s3.amazonaws.com",
  region: process.env.AWS_REGION,
});

const bucketName = process.env.AWS_BUCKET_NAME;

// Uploads multiple files to the AWS S3 bucket and returns their URLs that AWS creates.
const uploadFiles = async (files) => {
  try {
    const uploadPromises = files.map((file) => {
      const s3Key = `images/${Date.now()}-${file.originalname}`; // Key to store the file in S3 (adds a timestamp to the filename to make it unique)
      const fileStream = fs.createReadStream(file.path);
      const uploadParams = {
        Bucket: bucketName,
        Key: s3Key,
        Body: fileStream,
      };
      return s3.upload(uploadParams).promise();
    });

    const results = await Promise.all(uploadPromises);
    files.forEach((file) => fs.unlinkSync(file.path)); // Deletes the local files after it gets uploaded to the S3 bucket

    const urls = results.map((data) => data.Location);
    return urls;
  } catch (err) {
    console.error("Error uploading images to S3:", err);
  }
};

const uploadFile = (file) => {};

module.exports = {
  uploadFiles,
  uploadFile,
};
