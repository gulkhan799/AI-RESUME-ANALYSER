const { GoogleGenAI } = require("@google/genai")
const { z } = require("zod")
const { zodToJsonSchema } = require("zod-to-json-schema")
const puppeteer = require("puppeteer")
const fs = require("fs")
const os = require("os")
const path = require("path")

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY
})

const MODEL_NAME = "gemini-3-flash-preview"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const interviewReportSchema = z.object({
    matchScore: z.number().describe("A score between 0 and 100 indicating how well the candidate's profile matches the job description"),

    technicalQuestions: z.array(z.object({
        question: z.string().describe("The technical question that can be asked in the interview"),
        intention: z.string().describe("The intention of the interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Technical questions that can be asked in the interview along with their intention and how to answer them"),

    behavioralQuestions: z.array(z.object({
        question: z.string().describe("The behavioral question that can be asked in the interview"),
        intention: z.string().describe("The intention of the interviewer behind asking this question"),
        answer: z.string().describe("How to answer this question, what points to cover, what approach to take etc.")
    })).describe("Behavioral questions that can be asked in the interview along with their intention and how to answer them"),

    skillGaps: z.array(z.object({
        skill: z.string().describe("The skill which the candidate is lacking"),
        severity: z.enum(["low", "medium", "high"]).describe("The severity of this skill gap, i.e. how important is this skill for the job and how much it can impact the candidate's chances")
    })).describe("List of skill gaps in the candidate's profile along with their severity"),

    preparationPlan: z.array(z.object({
        day: z.number().describe("The day number in the preparation plan, starting from 1"),
        focus: z.string().describe("The main focus of this day in the preparation plan, e.g. data structures, system design, mock interviews etc."),
        tasks: z.array(z.string()).describe("List of tasks to be done on this day to follow the preparation plan, e.g. read a specific book or article, solve a set of problems, watch a video etc.")
    })).describe("A day-wise preparation plan for the candidate to follow in order to prepare for the interview effectively"),

    title: z.string().describe("The title of the job for which the interview report is generated"),
})

const resumePdfSchema = z.object({
    html: z.string().describe("The HTML content of the resume which can be converted to PDF using any library like puppeteer")
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recursively strips schema keywords that the Gemini API's `responseSchema`
 * does not understand. Gemini accepts an OpenAPI-3-style subset of JSON
 * Schema; keys like `$schema` and `additionalProperties` will cause the
 * request to be rejected if left in.
 */
function stripUnsupportedSchemaKeys(node) {
    if (Array.isArray(node)) {
        return node.map(stripUnsupportedSchemaKeys)
    }
    if (node && typeof node === "object") {
        const cleaned = {}
        for (const [key, value] of Object.entries(node)) {
            if (key === "$schema" || key === "additionalProperties") continue
            cleaned[key] = stripUnsupportedSchemaKeys(value)
        }
        return cleaned
    }
    return node
}

function toGeminiSchema(zodSchema) {
    // target: "openApi3" avoids $ref/definitions, which Gemini does not support
    const jsonSchema = zodToJsonSchema(zodSchema, { target: "openApi3", $refStrategy: "none" })
    return stripUnsupportedSchemaKeys(jsonSchema)
}

/**
 * Calls Gemini with a structured output schema and returns the parsed JSON.
 * Throws a descriptive error if the call fails or the response isn't valid JSON.
 */
async function generateStructuredContent({ prompt, schema, label }) {
    let response
    try {
        response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: toGeminiSchema(schema),
            }
        })
    } catch (err) {
        throw new Error(`Gemini request failed while generating ${label}: ${err.message}`)
    }

    const text = response?.text
    if (!text) {
        throw new Error(`Gemini returned an empty response while generating ${label}`)
    }

    try {
        return JSON.parse(text)
    } catch (err) {
        throw new Error(`Failed to parse Gemini's JSON response while generating ${label}: ${err.message}`)
    }
}

// Only jobDescription is truly required (matches the Mongoose schema, where
// `resume` and `selfDescription` are optional). The other two are allowed to
// be missing/empty and are simply substituted with placeholder text in the
// prompt so Gemini still has something sensible to work with.
function assertRequiredFields({ jobDescription }) {
    if (!jobDescription) {
        throw new Error("Missing required field: jobDescription")
    }
}

function withFallback(value, fallbackText) {
    return value && value.trim() ? value : fallbackText
}

/**
 * Looks for a locally installed Chrome, Edge, or Brave browser across
 * common install locations on Windows, macOS, and Linux. Returns null if
 * none is found, in which case the caller should set BROWSER_EXECUTABLE_PATH
 * manually or install Puppeteer's bundled Chromium
 * (`npx puppeteer browsers install chrome`).
 */
function findBrowserExecutable() {
    const platform = os.platform()
    const candidates = []

    if (platform === "win32") {
        const homeDir = os.homedir()
        candidates.push(
            "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
            "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
            path.join(homeDir, "AppData", "Local", "Google", "Chrome", "Application", "chrome.exe"),
            "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
            "C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            "C:\\Program Files (x86)\\BraveSoftware\\Brave-Browser\\Application\\brave.exe",
            path.join(homeDir, "AppData", "Local", "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
        )
    } else if (platform === "darwin") {
        candidates.push(
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser"
        )
    } else {
        candidates.push(
            "/usr/bin/google-chrome",
            "/usr/bin/google-chrome-stable",
            "/usr/bin/chromium",
            "/usr/bin/chromium-browser",
            "/usr/bin/microsoft-edge",
            "/usr/bin/brave-browser",
            "/usr/bin/brave",
            "/snap/bin/brave"
        )
    }

    return candidates.find((p) => fs.existsSync(p)) || null
}

/**
 * Renders HTML to a PDF buffer using Puppeteer.
 * Uses an explicit BROWSER_EXECUTABLE_PATH env var or a detected local
 * Chrome/Edge/Brave install if available, otherwise falls back to
 * Puppeteer's own bundled Chromium (only present if it wasn't skipped
 * during install — see Backend/.npmrc).
 */
async function generatePdfFromHtml(htmlContent) {
    const launchOptions = {
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }

    const executablePath = process.env.BROWSER_EXECUTABLE_PATH || findBrowserExecutable()
    if (executablePath) {
        launchOptions.executablePath = executablePath
    }

    let browser
    try {
        browser = await puppeteer.launch(launchOptions)
        const page = await browser.newPage()
        await page.setViewport({ width: 1200, height: 800 })
        await page.setContent(htmlContent, { waitUntil: "networkidle0" })

        const pdfData = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "20mm",
                bottom: "20mm",
                left: "15mm",
                right: "15mm"
            }
        })

        // Puppeteer v22+ returns a plain Uint8Array, not a Node Buffer.
        // Express's res.send() only recognizes true Buffers as binary data;
        // anything else gets silently JSON-stringified, corrupting the PDF.
        // Buffer.from() on an existing Uint8Array is a cheap view, not a copy.
        return Buffer.from(pdfData)
    } catch (err) {
        throw new Error(`Failed to generate PDF from HTML: ${err.message}`)
    } finally {
        if (browser) await browser.close()
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function generateInterviewReport({ resume, selfDescription, jobDescription }) {
    assertRequiredFields({ jobDescription })

    const resumeText = withFallback(resume, "Not provided.")
    const selfDescriptionText = withFallback(selfDescription, "Not provided.")

    const prompt = `Generate an interview report for a candidate with the following details:
Resume: ${resumeText}
Self Description: ${selfDescriptionText}
Job Description: ${jobDescription}`

    return generateStructuredContent({
        prompt,
        schema: interviewReportSchema,
        label: "interview report"
    })
}

async function generateResumePdf({ resume, selfDescription, jobDescription }) {
    assertRequiredFields({ jobDescription })

    const resumeText = withFallback(resume, "Not provided.")
    const selfDescriptionText = withFallback(selfDescription, "Not provided.")

    const prompt = `Generate a resume for a candidate with the following details:
Resume: ${resumeText}
Self Description: ${selfDescriptionText}
Job Description: ${jobDescription}

The response should be a JSON object with a single field "html" which contains the HTML content of the resume which can be converted to PDF using any library like puppeteer.
The resume should be tailored for the given job description and should highlight the candidate's strengths and relevant experience. The HTML content should be well-formatted and structured, making it easy to read and visually appealing.

CRITICAL FONT CONFIGURATION: Do NOT use any external fonts, @import font URLs, or custom web fonts (like Inter, Poppins, Roboto). Use ONLY standard web-safe system fonts in your CSS style block (e.g., font-family: Arial, Helvetica, sans-serif; or font-family: 'Times New Roman', Times, serif;).

The content of the resume should not sound like it's generated by AI and should be as close as possible to a real human-written resume.
You can highlight the content using some colors but keep the typography entirely restricted to standard system fonts. The overall design should be simple and professional.
The content should be ATS friendly, i.e. it should be easily parsable by ATS systems without losing important information.
The resume should not be lengthy, it should ideally be 1-2 pages long when converted to PDF. Focus on quality rather than quantity and make sure to include all the relevant information that can increase the candidate's chances of getting an interview call for the given job description.`

    const { html } = await generateStructuredContent({
        prompt,
        schema: resumePdfSchema,
        label: "resume HTML"
    })

    if (!html) {
        throw new Error("Gemini did not return HTML content for the resume")
    }

    return generatePdfFromHtml(html)
}

module.exports = { generateInterviewReport, generateResumePdf }