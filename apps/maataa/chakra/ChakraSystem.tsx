export type ChakraNode = {
  id: string;
  label: string;
  state: "quiet" | "active" | "blocked";
};

const defaultNodes: ChakraNode[] = [
  { id: "root", label: "Root", state: "active" },
  { id: "heart", label: "Heart", state: "quiet" },
  { id: "ajna", label: "Ajna", state: "quiet" },
];

export function ChakraSystem({ nodes = defaultNodes }: { nodes?: ChakraNode[] }) {
  return (
    <section className="chakra-system">
      <h2>ChakraSystem</h2>
      <ul>
        {nodes.map((node) => (
          <li data-state={node.state} key={node.id}>
            {node.label}
          </li>
        ))}
      </ul>
    </section>
  );
}
