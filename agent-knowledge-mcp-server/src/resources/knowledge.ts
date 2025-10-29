import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { KnowledgeDatabase } from '../database.js';

export function registerKnowledgeResources(server: McpServer, db: KnowledgeDatabase): void {
  // Resource 1: All features list
  server.registerResource(
    'all_features',
    'knowledge://features',
    {
      title: 'All Features',
      description: 'List of all features in the knowledge corpus with entry counts',
      mimeType: 'application/json',
    },
    async () => {
      const features = db.getFeatures();
      return {
        contents: [
          {
            uri: 'knowledge://features',
            mimeType: 'application/json',
            text: JSON.stringify(features, null, 2),
          },
        ],
      };
    }
  );

  // Resource 2: Feature-specific knowledge (with list function)
  server.registerResource(
    'feature_knowledge',
    new ResourceTemplate('knowledge://{feature}', {
      list: async () => {
        const features = db.getFeatures();
        return {
          resources: features.map((f) => ({
            uri: `knowledge://${f.feature}`,
            name: `${f.feature} Knowledge`,
            description: `${f.count} entries for ${f.feature}`,
            mimeType: 'application/json',
          })),
        };
      },
    }),
    {
      title: 'Feature Knowledge',
      description: 'All knowledge entries for a specific feature',
      mimeType: 'application/json',
    },
    async (uri, { feature }) => {
      const entries = db.retrieve(feature as string);
      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify({
              feature,
              count: entries.length,
              entries,
            }, null, 2),
          },
        ],
      };
    }
  );

  // Resource 3: Individual entry by ID (with list function)
  server.registerResource(
    'knowledge_entry',
    new ResourceTemplate('knowledge://{feature}/{id}', {
      list: async () => {
        // List all entries across all features
        const features = db.getFeatures();
        const allEntries = [];

        for (const featureSummary of features) {
          const entries = db.retrieve(featureSummary.feature);
          for (const entry of entries) {
            allEntries.push({
              uri: `knowledge://${entry.feature}/${entry.id}`,
              name: `${entry.feature} - ${entry.agent}`,
              description: entry.summary.substring(0, 100) + (entry.summary.length > 100 ? '...' : ''),
              mimeType: 'application/json',
            });
          }
        }

        return { resources: allEntries };
      },
    }),
    {
      title: 'Knowledge Entry',
      description: 'Individual knowledge entry by feature and ID',
      mimeType: 'application/json',
    },
    async (uri, { feature, id }) => {
      const entry = db.getById(id as string);

      if (!entry) {
        throw new Error(`Knowledge entry with ID "${id}" not found`);
      }

      if (entry.feature !== feature) {
        throw new Error(`Entry "${id}" does not belong to feature "${feature}"`);
      }

      return {
        contents: [
          {
            uri: uri.toString(),
            mimeType: 'application/json',
            text: JSON.stringify(entry, null, 2),
          },
        ],
      };
    }
  );
}
