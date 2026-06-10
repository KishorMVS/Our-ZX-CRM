const { RoomServiceClient, EgressClient } = require("livekit-server-sdk");
require("dotenv").config();

async function run() {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    const hostUrl = livekitUrl.replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
    const roomService = new RoomServiceClient(hostUrl, apiKey, apiSecret);
    const egressClient = new EgressClient(hostUrl, apiKey, apiSecret);

    try {
        console.log("Creating room 'test-active-room-3'...");
        await roomService.createRoom({
            name: "test-active-room-3",
            emptyTimeout: 60,
        });
        console.log("Room created successfully!");

        console.log("Starting egress on 'test-active-room-3' with explicit dummy S3 config...");
        // Let's pass a dummy S3 upload destination
        const res = await egressClient.startRoomCompositeEgress("test-active-room-3", {
            file: {
                filepath: "recordings/test-active-3.mp4",
                s3: {
                    accessKey: "dummy-key",
                    secret: "dummy-secret",
                    bucket: "dummy-bucket",
                    region: "us-east-1",
                }
            }
        });
        console.log("Egress started!", res);
    } catch (err) {
        console.error("ERROR:");
        console.error(err);
        if (err.message) console.error("Error message:", err.message);
    }
}

run();
