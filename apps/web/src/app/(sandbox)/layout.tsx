export default function SandboxGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sandbox-layout min-h-[calc(100vh-64px)]">
      {children}
    </div>
  );
}
