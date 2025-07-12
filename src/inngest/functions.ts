import { inngest } from "./client";
import { gemini, createAgent } from "@inngest/agent-kit";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
      const codeAgent = createAgent({
        name: "code-agent",
        system: "You are an expert next.js developer. You write readable, maintainable code. You write simple Next.js & React snippets",
        model: gemini({ model: "gemini-1.5-flash", apiKey: process.env.GEMINI_API_KEY }),
        });

      const { output } = await codeAgent.run(
        `Write the following snippet: ${event.data.value}`
      );

      return { output };
  },
);