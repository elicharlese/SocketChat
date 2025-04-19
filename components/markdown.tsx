"use client"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"

interface MarkdownProps {
  children: string
}

export function Markdown({ children }: MarkdownProps) {
  return (
    <ReactMarkdown
      rehypePlugins={[rehypeRaw]}
      remarkPlugins={[remarkGfm]}
      className="prose prose-invert max-w-none break-words"
      components={{
        a: ({ node, ...props }) => (
          <a
            {...props}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline decoration-blue-500/30 hover:decoration-blue-400/50 transition-colors duration-200 font-medium"
          />
        ),
        p: ({ node, ...props }) => <p {...props} className="my-1" />,
        ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-6 my-1" />,
        ol: ({ node, ...props }) => <ol {...props} className="list-decimal pl-6 my-1" />,
        li: ({ node, ...props }) => <li {...props} className="my-0.5" />,
        h1: ({ node, ...props }) => <h1 {...props} className="text-xl font-bold my-2" />,
        h2: ({ node, ...props }) => <h2 {...props} className="text-lg font-bold my-2" />,
        h3: ({ node, ...props }) => <h3 {...props} className="text-md font-bold my-1" />,
        h4: ({ node, ...props }) => <h4 {...props} className="font-bold my-1" />,
        pre: ({ node, ...props }) => <pre {...props} className="bg-gray-900 p-2 rounded my-2 overflow-x-auto" />,
        code: ({ node, inline, ...props }) =>
          inline ? <code {...props} className="bg-gray-900 px-1 py-0.5 rounded" /> : <code {...props} />,
        blockquote: ({ node, ...props }) => (
          <blockquote {...props} className="border-l-4 border-gray-500 pl-2 my-2 italic text-gray-300" />
        ),
        hr: ({ node, ...props }) => <hr {...props} className="my-4 border-gray-600" />,
        img: ({ node, ...props }) => <img {...props} className="max-w-full h-auto rounded my-2" />,
        table: ({ node, ...props }) => (
          <div className="overflow-x-auto my-2">
            <table {...props} className="border-collapse w-full" />
          </div>
        ),
        th: ({ node, ...props }) => <th {...props} className="border border-gray-600 px-2 py-1 bg-gray-800" />,
        td: ({ node, ...props }) => <td {...props} className="border border-gray-600 px-2 py-1" />,
      }}
    >
      {children}
    </ReactMarkdown>
  )
}

