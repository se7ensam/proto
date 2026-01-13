export default function TypingIndicator() {
  return (
    <span 
      className="inline-block w-0.5 h-5 bg-gray-500 ml-1 align-middle"
      style={{
        animation: 'blink 1s infinite'
      }}
    />
  )
}
