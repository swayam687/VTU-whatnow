# React UI guidelines

Use React Bits components when an existing React Bits component fits the requested UI. Before implementing a custom animated component:
1. Search the React Bits registry through the shadcn MCP server.
2. Prefer the TypeScript and Tailwind variant when this project uses TypeScript and Tailwind.
3. Install the component into the project's local components directory.
4. Inspect the generated source and its dependencies.
5. Reuse the component rather than recreating it from memory.
6. Preserve accessibility, responsive behavior, and the project's existing design tokens.
7. Run the project build or relevant tests after installation.

When proposing a React Bits component, explain its name, required dependencies, and where it was installed.
