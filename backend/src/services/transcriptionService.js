const OpenAI = require("openai");
const fs = require("fs");
const path = require("path");
const { execSync, execFileSync } = require("child_process");
const axios = require("axios");

// Use bundled ffmpeg binaries — no system install required
let FFMPEG_PATH = "ffmpeg";
let FFPROBE_PATH = "ffprobe";
try {
    FFMPEG_PATH = require("@ffmpeg-installer/ffmpeg").path;
} catch { /* fall back to system ffmpeg if package missing */ }
try {
    FFPROBE_PATH = require("@ffprobe-installer/ffprobe").path;
} catch { /* fall back to system ffprobe */ }

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Get audio duration using ffprobe
 */
function getAudioDuration(filePath) {
    try {
        const result = execFileSync(FFPROBE_PATH, [
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            filePath,
        ], { encoding: "utf-8", timeout: 15000 });
        return parseFloat(result.trim());
    } catch {
        return null;
    }
}

/**
 * Split audio into chunks using ffmpeg
 */
function splitAudio(filePath, chunkLengthSec = 600) {
    const duration = getAudioDuration(filePath);
    if (!duration || duration <= chunkLengthSec) {
        return [filePath];
    }

    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const base = path.basename(filePath, ext);
    const chunks = [];
    let start = 0;
    let index = 0;

    while (start < duration) {
        const chunkPath = path.join(dir, `${base}_chunk${index}${ext}`);
        try {
            execFileSync(FFMPEG_PATH, [
                "-y", "-i", filePath,
                "-ss", String(start), "-t", String(chunkLengthSec),
                "-acodec", "copy", chunkPath,
            ], { encoding: "utf-8", timeout: 60000, stdio: "pipe" });
            chunks.push(chunkPath);
        } catch (err) {
            console.error(`Failed to split chunk ${index}:`, err.message);
            break;
        }
        start += chunkLengthSec;
        index++;
    }

    return chunks.length > 0 ? chunks : [filePath];
}

/**
 * Download a recording from URL to a temp file
 */
async function downloadRecording(url, destPath, headers = {}) {
    const response = await axios({
        method: "GET",
        url,
        responseType: "stream",
        timeout: 60000,
        headers,
    });

    const writer = fs.createWriteStream(destPath);
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
    });
}

// Pass 1: Quick transcription for context
async function getQuickTranscription(filePath) {
    console.log("Pass 1: Quick transcription for context...");
    const quickTranscription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
        response_format: "text",
        language: "en",
    });

    return typeof quickTranscription === "string"
        ? quickTranscription
        : quickTranscription.text || String(quickTranscription);
}

// Pass 2: Full detailed transcription with context
async function transcribeSingleFile(filePath, contextPrompt) {
    return await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["segment"],
        language: "en",
        prompt: contextPrompt,
    });
}

// Pass 3: AI analysis + summary
async function generateFullSummary(fullTranscriptText) {
    console.log("Pass 3: Generating summary + metadata...");

    const summaryResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are an expert call analyst. You are given the full English transcription of a call recording.

You must respond with ONLY a valid JSON object (no markdown, no code fences). The JSON must have these exact keys:

{
  "summary": "<comprehensive summary string>",
  "tone": "<one of: Professional, Casual, Frustrated, Polite, Aggressive, Neutral>",
  "urgency": "<one of: High, Medium, Low>",
  "emotion": "<one of: Calm, Angry, Anxious, Happy, Sad, Neutral>",
  "category": "<one of: Complaint, Inquiry, Follow-up, Sales, Support, General>",
  "sentiment": "<strictly one of: Good, Bad, Neutral>",
  "feedback": "<bullet points or a short paragraph extracting constructive feedback or key takeaways from the call>",
  "conclusion": "<how the call concluded, final agreements or tone>"
}

For the "summary" field, write a COMPREHENSIVE and DETAILED English summary including:
1. Call Overview - purpose, participants, context
2. Detailed Summary - point-by-point discussion
3. Key Points - decisions, requests, complaints
4. Actions/Outcomes - next steps, resolutions
5. Conclusion - how the call ended

Make it detailed enough that someone who didn't listen can fully understand. Write in English.`,
            },
            {
                role: "user",
                content: `Here is the full transcription of a call recording:\n\n${fullTranscriptText}\n\nGenerate the JSON response with summary and metadata.`,
            },
        ],
        max_tokens: 2000,
        temperature: 0.3,
    });

    const raw = summaryResponse.choices[0]?.message?.content?.trim() || "{}";

    try {
        const parsed = JSON.parse(raw);
        return {
            summary: parsed.summary || "",
            tone: parsed.tone || "Neutral",
            urgency: parsed.urgency || "Medium",
            emotion: parsed.emotion || "Neutral",
            category: parsed.category || "General",
            sentiment: parsed.sentiment || "Neutral",
            feedback: parsed.feedback || "No specific feedback mentioned.",
            conclusion: parsed.conclusion || "No clear conclusion.",
        };
    } catch {
        return {
            summary: raw,
            tone: "Neutral",
            urgency: "Medium",
            emotion: "Neutral",
            category: "General",
            sentiment: "Neutral",
            feedback: "Parsing failed.",
            conclusion: "Parsing failed.",
        };
    }
}

function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
        return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
    }
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

/**
 * Convert any audio file to a valid MP3 using ffmpeg.
 * TeleCMI recordings come with .mp3 extension but often use AMR/G711 codec
 * that Whisper rejects. Re-encoding to libmp3lame guarantees compatibility.
 * Returns the converted file path (caller must delete it).
 */
function convertToMp3(inputPath) {
    const outputPath = inputPath.replace(/(\.[^.]+)?$/, "_converted.mp3");
    try {
        execFileSync(FFMPEG_PATH, [
            "-y", "-i", inputPath,
            "-vn", "-acodec", "libmp3lame",
            "-ar", "16000", "-ac", "1", "-b:a", "64k",
            outputPath,
        ], { encoding: "utf-8", timeout: 120000, stdio: "pipe" });
        return outputPath;
    } catch (err) {
        console.error("[Transcription] ffmpeg conversion failed:", err.message);
        return null;
    }
}

/**
 * Main transcription function - downloads recording and runs 3-pass transcription
 * @param {string} recordingUrl
 * @param {Object} [headers] - Optional HTTP headers (e.g. Authorization for PIOPIY)
 */
async function transcribeFromUrl(recordingUrl, headers = {}) {
    const uploadsDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const tempFile = path.join(uploadsDir, `recording_${Date.now()}.raw`);
    let convertedFile = null;

    try {
        console.log("Downloading recording...");
        await downloadRecording(recordingUrl, tempFile, headers);

        // Always convert to ensure Whisper-compatible MP3
        convertedFile = convertToMp3(tempFile);
        const fileToTranscribe = convertedFile || tempFile;

        return await runThreePassTranscription(fileToTranscribe, false);
    } finally {
        try { fs.unlinkSync(tempFile); } catch { }
        if (convertedFile) { try { fs.unlinkSync(convertedFile); } catch { } }
    }
}

/**
 * Transcribe from a local file path (no download needed)
 */
async function transcribeFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Recording file not found: ${filePath}`);
    }

    console.log(`Transcribing local file: ${filePath}`);
    const convertedFile = convertToMp3(filePath);
    const fileToTranscribe = convertedFile || filePath;
    try {
        return await runThreePassTranscription(fileToTranscribe, false);
    } finally {
        if (convertedFile) { try { fs.unlinkSync(convertedFile); } catch { } }
    }
}

// Default context prompt for sales calls — used when audio is short (skips Pass 1 upload)
const SALES_CONTEXT_PROMPT = "This is a sales call recording between a sales representative and a potential customer. Topics include product interest, pricing, budget, and next steps.";

/**
 * Core 3-pass transcription logic
 * @param {string} filePath - Path to the audio file
 * @param {boolean} cleanup - Whether to delete the file after processing
 */
async function runThreePassTranscription(filePath, cleanup = false) {
    try {
        console.log("Starting 3-pass transcription...");

        // Pass 1: only run for long calls (> 10 min) where context helps accuracy
        // For short calls, use the default sales prompt to avoid double-uploading
        const audioDuration = getAudioDuration(filePath);
        let contextPrompt = SALES_CONTEXT_PROMPT;
        if (audioDuration && audioDuration > 600) {
            const roughText = await getQuickTranscription(filePath);
            contextPrompt = roughText.length > 500 ? roughText.substring(0, 500) + "..." : roughText;
        } else {
            console.log("Pass 1: Skipped (call < 10 min) — using default sales context prompt.");
        }

        // Pass 2
        console.log("Pass 2: Full detailed transcription...");
        const chunks = splitAudio(filePath, 600);

        let allSegments = [];
        let allText = [];
        let totalDuration = 0;
        let timeOffset = 0;

        for (let i = 0; i < chunks.length; i++) {
            const transcription = await transcribeSingleFile(chunks[i], contextPrompt);

            if (transcription.text) allText.push(transcription.text);
            if (transcription.duration) totalDuration += transcription.duration;

            if (transcription.segments?.length > 0) {
                const adjusted = transcription.segments.map((seg) => ({
                    ...seg,
                    start: seg.start + timeOffset,
                    end: seg.end + timeOffset,
                }));
                allSegments = allSegments.concat(adjusted);
            }

            if (transcription.duration) timeOffset += transcription.duration;

            if (chunks[i] !== filePath) {
                try { fs.unlinkSync(chunks[i]); } catch { }
            }
        }

        const plainText = allText.join(" ");
        const duration = totalDuration > 0 ? Math.round(totalDuration) : null;

        let timestampedText = plainText;
        if (allSegments.length > 0) {
            timestampedText = allSegments
                .map((seg) => `[${formatTime(seg.start)} - ${formatTime(seg.end)}] ${seg.text.trim()}`)
                .join("\n");
        }

        // Pass 3
        const metadata = await generateFullSummary(plainText);

        console.log("Transcription complete.");

        return {
            transcription: timestampedText,
            plainText,
            duration,
            ...metadata,
        };
    } finally {
        if (cleanup) {
            try { fs.unlinkSync(filePath); } catch { }
        }
    }
}

/**
 * Score a call conversation against admin-configured parameters.
 * Each parameter has { id, name, description, maxPoints }.
 * Returns { callScore, scoreBreakdown } where callScore <= sum of maxPoints (capped at 30).
 *
 * @param {string} transcriptText - Plain text of the conversation
 * @param {Array} scoringParams - Array of { id, name, description, maxPoints }
 * @returns {Promise<{ callScore: number, scoreBreakdown: Array }>}
 */
async function scoreCallConversation(transcriptText, scoringParams) {
    if (!scoringParams || scoringParams.length === 0) {
        return { callScore: 0, scoreBreakdown: [] };
    }

    const paramList = scoringParams
        .map((p, i) => `${i + 1}. "${p.name}" (max ${p.maxPoints} pts): ${p.description || ""}`)
        .join("\n");

    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            {
                role: "system",
                content: `You are a sales call quality analyst. You will be given a call transcript and a list of scoring parameters. For each parameter, assign a score between 0 and its maximum points based strictly on evidence in the conversation.

Respond with ONLY a valid JSON array (no markdown, no extra text):
[
  { "id": "<param id>", "name": "<param name>", "maxPoints": <number>, "score": <number>, "reason": "<one sentence why>" },
  ...
]`,
            },
            {
                role: "user",
                content: `Scoring parameters:\n${paramList}\n\nCall transcript:\n${transcriptText}\n\nScore each parameter based on the conversation evidence.`,
            },
        ],
        max_tokens: 800,
        temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "[]";

    try {
        const parsed = JSON.parse(raw);
        const breakdown = parsed.map((item, i) => {
            const param = scoringParams.find(p => p.id === item.id) || scoringParams[i] || {};
            const maxPts = param.maxPoints || item.maxPoints || 0;
            const scored = Math.min(Math.max(0, Math.round(item.score || 0)), maxPts);
            return {
                id: param.id || item.id,
                name: param.name || item.name,
                maxPoints: maxPts,
                score: scored,
                reason: item.reason || "",
            };
        });

        const total = breakdown.reduce((sum, b) => sum + b.score, 0);
        const callScore = Math.min(total, 30);

        return { callScore, scoreBreakdown: breakdown };
    } catch {
        return { callScore: 0, scoreBreakdown: [] };
    }
}

module.exports = { transcribeFromUrl, transcribeFromFile, scoreCallConversation };
