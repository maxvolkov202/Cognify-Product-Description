import { useEffect, useState } from "react";

interface ConfettiProps {
  trigger: boolean;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  rotation: number;
  scale: number;
}

export function Confetti({ trigger }: ConfettiProps) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!trigger) return;

    // Generate particles
    const colors = ["#5CB3FF", "#9D7BF5", "#E86DE1", "#60D9FA", "#B794F6"];
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < 25; i++) {
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 30, // Center around 50%
        y: 20,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        scale: 0.5 + Math.random() * 0.5
      });
    }

    setParticles(newParticles);
    setShow(true);

    // Auto-hide after animation
    const timer = setTimeout(() => {
      setShow(false);
      setParticles([]);
    }, 2000);

    return () => clearTimeout(timer);
  }, [trigger]);

  if (!show || particles.length === 0) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute w-2 h-2 animate-confetti-fall"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            backgroundColor: particle.color,
            transform: `rotate(${particle.rotation}deg) scale(${particle.scale})`,
            animation: `confetti-fall 1.5s ease-out forwards`,
            animationDelay: `${Math.random() * 0.2}s`,
            borderRadius: Math.random() > 0.5 ? "50%" : "0"
          }}
        />
      ))}
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(400px) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
