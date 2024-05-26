// Header: MongoDB Atlas Function to Process Document Changes
// Inputs: MongoDB changeEvent object
// Outputs: Updates the MongoDB document with processing status and AWS model response

exports = async function(changeEvent) {
  // Connect to MongoDB service
  var serviceName = "mongodb-atlas";
  var dbName = changeEvent.ns.db;
  var collName = changeEvent.ns.coll;

  try {
    var collection = context.services.get(serviceName).db(dbName).collection(collName);

    // Set document status to 'pending'
    await collection.updateOne({'_id' : changeEvent.fullDocument._id}, {$set : {processing : 'pending'}});

    // AWS SDK setup for invoking models
    const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
    const client = new BedrockRuntimeClient({
      region: 'us-east-1',
      credentials: {
        accessKeyId:  context.values.get('AWS_ACCESS_KEY'),
        secretAccessKey: context.values.get('AWS_SECRET_KEY')
      },
      model: "amazon.titan-embed-text-v1",
    });

    // Prepare embedding input from the change event
    let embedInput = {}
    if (changeEvent.fullDocument.title) {
      embedInput['inputText'] = changeEvent.fullDocument.title
    }
    let frame = null;
    let timestamp = null;
    if (changeEvent.fullDocument.imgUrl) {
      const imageResponse = await context.http.get({ url: changeEvent.fullDocument.imgUrl });
      const imageBase64 = imageResponse.body.toBase64();
      embedInput['inputImage'] = imageBase64
      frame = imageResponse.body.buffer;
    }
    if (changeEvent.fullDocument.timestamp) {
      timestamp = changeEvent.fullDocument.timestamp;
    }

    // AWS SDK call to process the embedding
    const input = {
      "modelId": "amazon.titan-embed-image-v1",
      "contentType": "application/json",
      "accept": "*/*",
      "body": JSON.stringify(embedInput)
    };

    console.log(`before model invoke ${JSON.stringify(input)}`);
    const command = new InvokeModelCommand(input);
    const response = await client.send(command);
    
    // Parse and update the document with the response
    const responseBody = JSON.parse(Buffer.from(response.body).toString('utf-8'));
    const embedding = responseBody.embedding;

    // Create a new document with the embedding, timestamp, and frame
    const newDocument = {
      _id: `processed_${changeEvent.fullDocument._id}`,
      originalId: changeEvent.fullDocument._id,
      embedding: embedding,
      timestamp: timestamp,
      frame: frame,
      processing: 'completed'
    };

    // Insert the new document
    await collection.insertOne(newDocument);

 } catch(err) {
   // Handle any errors in the process
   console.error(err)
 }
};