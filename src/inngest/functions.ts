import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import { gemini, createAgent } from "@inngest/agent-kit";
import { getSandbox } from "./utils";

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sand-box-id", async () => {
      const sandbox = await Sandbox.create("create-ai-nextjs-1752487655");
      return sandbox.sandboxId;
    })
      const codeAgent = createAgent({
        name: "code-agent",
        system: "You are an expert next.js developer. You write readable, maintainable code. You write simple Next.js & React snippets",
        model: gemini({ model: "gemini-1.5-flash", apiKey: process.env.GEMINI_API_KEY }),
        });

      const { output } = await codeAgent.run(
        `Write the following snippet: ${event.data.value}`
      );

      const sandboxUrl = await step.run("get-sandbox-url", async () => {
        const sandbox = await getSandbox(sandboxId);
        const host = sandbox.getHost(3000);
        return `https://${host}`;
      })

      return { output, sandboxUrl };
  },
);