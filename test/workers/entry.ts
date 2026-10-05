// A stand-in Worker for the workers test project: the tests import the modules they test directly.
export default {
  async fetch() {
    return new Response('test entry');
  },
} satisfies ExportedHandler;
