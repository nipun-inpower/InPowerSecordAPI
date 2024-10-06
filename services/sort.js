// This is needed to sort the feeds by creation date, instead of the order they were fetched from the database

const orderByDate = (feedA, feedB) => {
  // If feed A is newer place it after feed B in the array
  if (feedA.createdAt > feedB.createdAt) {
    return 1;
  } else if (feedA.createdAt < feedB.createdAt) {
    // If feed A is older place it before feed B in the array
    return -1;
  } else {
    // If the dates are the same then keep the original order of feed A and feed B
    return 0;
  }
};

module.exports = {
  orderByDate,
};
