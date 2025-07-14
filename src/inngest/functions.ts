import { z, AnyZodObject } from "zod";
import { PROMPT } from "@/prompt";
import { inngest } from "./client";
import { Sandbox } from "@e2b/code-interpreter";
import {
  gemini,
  createAgent,
  createTool,
  createNetwork,
} from "@inngest/agent-kit";
import { getSandbox, lastAssistantTextMessageContent } from "./utils";

type StateData = {
  summary?: string;
  files?: Record<string, string>;
};

// Schemas
const terminalSchema: AnyZodObject = z.object({
  command: z.string(),
});

const createOrUpdateFilesSchema: AnyZodObject = z.object({
  files: z.array(
    z.object({
      path: z.string(),
      content: z.string(),
    })
  ),
});

const readFilesSchema: AnyZodObject = z.object({
  files: z.array(z.string()),
});

export const helloWorld = inngest.createFunction(
  { id: "hello-world" },
  { event: "test/hello.world" },
  async ({ event, step }) => {
    const sandboxId = await step.run("get-sandbox-id", async () => {
      const sandbox = await Sandbox.create("create-ai-nextjs-1752487655");
      return sandbox.sandboxId;
    });

    const codeAgent = createAgent({
      name: "code-agent",
      description: "An expert coding agent",
      system: PROMPT,
      model: gemini({
        model: "gemini-1.5-flash",
        apiKey: process.env.GEMINI_API_KEY!,
      }),
      tools: [
        createTool({
          name: "terminal",
          description: "Use the terminal to run commands",
          parameters: terminalSchema,
          handler: async ({ command }, { step }) => {
            return await step.run("terminal", async () => {
              const sandbox = await getSandbox(sandboxId);
              const buffers = { stdout: "", stderr: "" };
              const result = await (sandbox.commands as any).run(command, {
                onStdout: ({ data }: { data: string }) => {
                  buffers.stdout += data;
                },
                onStderr: ({ data }: { data: string }) => {
                  buffers.stderr += data;
                },
              });
              return result.stdout || `stderr: ${buffers.stderr}`;
            });
          },
        }),

        createTool({
          name: "createOrUpdateFiles",
          description: "Create or update files in the sandbox",
          parameters: createOrUpdateFilesSchema,
          handler: async ({ files }, { step, network }) => {
            const updatedFiles = await step.run("create-files", async () => {
              const sandbox = await getSandbox(sandboxId);
              const updated: Record<string, string> = {};
              for (const file of files) {
                await sandbox.files.write(file.path, file.content);
                updated[file.path] = file.content;
              }
              return updated;
            });
            network.state.data.files = {
              ...(network.state.data.files || {}),
              ...updatedFiles,
            };
            return { success: true };
          },
        }),

        createTool({
          name: "readFiles",
          description: "Read files from the sandbox",
          parameters: readFilesSchema,
          handler: async ({ files }, { step }) => {
            return await step.run("read-files", async () => {
              const sandbox = await getSandbox(sandboxId);
              const result = await Promise.all(
                files.map(async (file) => ({
                  path: file,
                  content: await sandbox.files.read(file),
                }))
              );
              return JSON.stringify(result);
            });
          },
        }),
      ],
      lifecycle: {
        onResponse: async ({ result, network }) => {
          const summary = lastAssistantTextMessageContent(result);
          if (summary?.includes("<task_summary>")) {
            network.state.data.summary = summary.trim();
          }
          return result;
        },
      },
    });

    const network = createNetwork<StateData>({
      name: "coding-agent-network",
      agents: [codeAgent],
      maxIter: 20,
      router: async ({ network }) => {
        if (network.state.data.summary) return;
        return codeAgent;
      },
    });

    const result = await network.run(event.data.value);

    const sandboxUrl = await step.run("get-url", async () => {
      const sandbox = await getSandbox(sandboxId);
      return `https://${sandbox.getHost(3000)}`;
    });

    return {
      url: sandboxUrl,
      title: "Fragment",
      files: result.state.data.files,
      summary: result.state.data.summary,
    };
  }
);
