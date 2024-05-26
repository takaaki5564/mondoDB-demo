// Function Name : getProducts

exports = async function({ body }, response) {

  // Import required SDKs and initialize AWS BedrockRuntimeClient
  const { BedrockRuntimeClient, InvokeModelCommand } = require("@aws-sdk/client-bedrock-runtime");
  const client = new BedrockRuntimeClient({
    region: 'us-east-1',
    credentials: {
      accessKeyId: context.values.get('AWS_ACCESS_KEY'),
      secretAccessKey: context.values.get('AWS_SECRET_KEY')
    }
  });

  // MongoDB and AWS SDK service setup
  const serviceName = "mongodb-atlas";
  const dbName = "cluster0";
  const collName = "video1_frames";
  const collection = context.services.get(serviceName).db(dbName).collection(collName);

  // 埋め込みベクトルを生成する関数
  async function getMultimodalVector(input_image_base64 = null, input_text = null) {
    const request_body = {};
    if (input_image_base64) {
      request_body["inputImage"] = input_image_base64;
    }
    if (input_text) {
      request_body["inputText"] = input_text;
    }
    request_body["embeddingConfig"] = {"outputEmbeddingLength": 384};
    
    const command = new InvokeModelCommand({
      modelId: "amazon.titan-embed-image-v1",
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(request_body)
    });

    const response = await client.send(command);
    const response_body = JSON.parse(Buffer.from(response.body).toString('utf-8'));
    return response_body.embedding;
  }

  try {
    const { text, imageBase64 } = JSON.parse(body.text());

    let query_embedding;
    if (text) {
      query_embedding = await getMultimodalVector(null, text);
    } else if (imageBase64) {
      query_embedding = await getMultimodalVector(imageBase64, null);
    } else {
      response.setStatusCode(400);
      response.setBody(JSON.stringify({ error: "No valid input provided" }));
      return;
    }

    const documents = await collection.aggregate([
      {
        "$vectorSearch": {
          "index": "default",
          "path": "embedding",
          "queryVector": query_embedding,
          "numCandidates": 100,
          "limit": 9
        }
      },
      {
        "$project": {
          "_id": 1,
          "frame": 1,
          "timestamp": 1,
          "score": {"$meta": "vectorSearchScore"}
        }
      }
    ]).toArray();

    if (documents.length === 0) {
      response.setBody(JSON.stringify({ message: "No similar images found" }));
      response.setStatusCode(404);
    } else {
      response.setBody(JSON.stringify(documents));
      response.setStatusCode(200);
    }

  } catch (err) {
    console.error("Error: ", err);
    response.setStatusCode(500);
    response.setBody(JSON.stringify({ error: "An error occurred while processing the request." }));
  }
};
