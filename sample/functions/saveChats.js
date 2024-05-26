// This function is the endpoint's request handler.
exports = async function({ query, headers, body}, response) {
   // Data can be extracted from the request as follows:


   // Headers, e.g. {"Content-Type": ["application/json"]}
   const contentTypes = headers["Content-Type"];


   const {player , messages } = JSON.parse(body.text());


   // Querying a mongodb service:
   const doc = await context.services.get("mongodb-atlas").db("bedrock").collection("players").findOneAndUpdate({player : player}, {$set : {messages : messages}}, {returnNewDocument : true});
  


  return doc;
};