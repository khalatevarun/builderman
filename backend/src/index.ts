require("dotenv").config();
import express from "express";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { basePrompt as reactBasePrompt } from "./defaults/react";
import { basePrompt as nodeBasePrompt } from "./defaults/node";
import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import cors from "cors";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: process.env.OPENROUTER_BASE_URL,
});

const app = express();
app.use(cors());
app.use(express.json());

const MODEL = "mistralai/devstral-2512:free";

app.post("/template", async (req, res) => {
  const prompt = req.body.prompt;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "Return either node or react based on what do you think this project should be. Only return a single word either 'node' or 'react'. Do not return anything extra",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 200,
  });

  const answer = response.choices[0]?.message?.content?.trim().toLowerCase() ?? "";
  if (answer === "react") {
    res.json({
      prompts: [
        BASE_PROMPT,
        `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`,
      ],
      uiPrompts: [reactBasePrompt],
    });
    return;
  }

  if (answer === "node") {
    res.json({
      prompts: [
        `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n  - .gitignore\n  - package-lock.json\n`,
      ],
      uiPrompts: [nodeBasePrompt],
    });
    return;
  }

  res.status(403).json({ message: "You cant access this" });
});

app.post("/enhance-prompt", async (req, res) => {
  const { message } = req.body;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: "user",
          content: `Enhance this prompt to be more specific and detailed. Create a single artifact with the improved prompt and nothing else.

                <original_prompt>
                ${message}
                </original_prompt>`,
        },
      ],
      max_tokens: 1000,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error("Error initiating stream:", error);
    res.write(`data: ${JSON.stringify({ error: "Failed to initiate streaming" })}\n\n`);
    res.end();
  }
});

app.post("/chat", async (req, res) => {
  const messages = req.body.messages as ChatCompletionMessageParam[];

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: getSystemPrompt() }, ...messages],
    max_tokens: 8000,
  });

  const content = response.choices[0]?.message?.content;
  console.log(response);
  res.json({ response: content ?? "" });
});

app.listen(3000);
