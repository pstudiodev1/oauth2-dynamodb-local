const aws = require("aws-sdk");
aws.config.update({
  region: "local",
  endpoint: "http://localhost:8000"
});

const tables = ["clients", "tokens"];
const dynamodb = new aws.DynamoDB();

tables.forEach(e => {
  var params = {
      TableName : e,
  };

  dynamodb.deleteTable(params, function(err, data) {
      if (err) {
          console.error("Unable to delete table " + e + ". Error JSON:", JSON.stringify(err, null, 2));
      } else {
          console.log("Deleted table " + e + ". Table description JSON:", JSON.stringify(data, null, 2));
      }
  });
});
