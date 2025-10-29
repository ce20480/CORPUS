import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export function registerWorkflowPrompts(server: McpServer): void {
  // Prompt 1: Share Knowledge Workflow
  server.registerPrompt(
    'share_knowledge_workflow',
    {
      title: 'Share Knowledge Workflow',
      description: 'Guided workflow for sharing knowledge to the corpus',
      argsSchema: {
        agent: z.string().describe('Your agent identifier'),
        feature: z.string().describe('Feature you worked on'),
      },
    },
    async ({ agent, feature }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are ${agent} and have completed work on the feature "${feature}".

Please share your knowledge to the corpus by:

1. **Summarizing what you accomplished**: What did you implement, discover, or learn?

2. **Key decisions**: What important technical decisions did you make and why?

3. **Challenges encountered**: What problems did you face and how did you solve them?

4. **Important files/locations**: Which files did you create or modify?

5. **Next steps**: What should other agents know before continuing this work?

Use the agent_knowledge_share tool with:
- agent: "${agent}"
- feature: "${feature}"
- summary: A detailed summary covering the above points
- branch: Your git branch if relevant
- metadata: Include files changed, errors fixed, dependencies added, etc.`,
            },
          },
        ],
      };
    }
  );

  // Prompt 2: Find Related Knowledge
  server.registerPrompt(
    'find_related_knowledge',
    {
      title: 'Find Related Knowledge',
      description: 'Search and summarize knowledge related to your task',
      argsSchema: {
        feature: z.string().describe('Feature to search for'),
        agent: z.string().optional().describe('Filter by specific agent'),
      },
    },
    async ({ feature, agent }) => {
      const agentFilter = agent ? ` from agent "${agent}"` : ' from all agents';

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are about to work on the feature "${feature}".

Before starting, retrieve existing knowledge${agentFilter} by:

1. **Use agent_knowledge_retrieve tool** with:
   - feature: "${feature}"${agent ? `\n   - agent: "${agent}"` : ''}

2. **Analyze the results**:
   - What has already been implemented?
   - What challenges did others encounter?
   - Are there any blockers or warnings?
   - What decisions have been made?

3. **Summarize your findings**:
   - Current state of the feature
   - What you can build on
   - What needs to be done differently
   - Any gaps in the existing knowledge

4. **Decide your approach** based on this knowledge before proceeding.

This will help you avoid duplicating work and learn from others' experience.`,
            },
          },
        ],
      };
    }
  );

  // Prompt 3: Orchestrate Feature
  server.registerPrompt(
    'orchestrate_feature',
    {
      title: 'Orchestrate Feature',
      description: 'Analyze feature status and coordinate next steps across agents',
      argsSchema: {
        feature: z.string().describe('Feature to orchestrate'),
      },
    },
    async ({ feature }) => {
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `You are the orchestration agent analyzing the feature "${feature}".

Perform a comprehensive analysis:

1. **Retrieve all knowledge** for this feature:
   - Use agent_knowledge_retrieve tool with feature: "${feature}"

2. **Analyze agent contributions**:
   - Which agents have contributed?
   - What did each agent accomplish?
   - Are agents working in sync or creating conflicts?

3. **Identify gaps and issues**:
   - Is frontend implemented without backend?
   - Are there unresolved errors or blockers?
   - Is knowledge conflicting or inconsistent?
   - Are there missing components?

4. **Assess feature health**:
   - What percentage is complete?
   - What's blocking progress?
   - Which agent should work next?

5. **Provide coordination insights**:
   - Summarize the current state
   - Recommend next steps
   - Identify which agent should act
   - Highlight any coordination issues

6. **Share your orchestration findings**:
   - Use agent_knowledge_share tool to record your analysis
   - Set agent: "orchestration-agent"
   - Set feature: "orchestration-insights" or "${feature}"
   - Include recommendations in summary

This helps maintain project coherence across multiple agents.`,
            },
          },
        ],
      };
    }
  );
}
