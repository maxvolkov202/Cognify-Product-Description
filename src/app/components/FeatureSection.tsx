import { ImageWithFallback } from "./figma/ImageWithFallback";

interface FeatureSectionProps {
  headline: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
  children?: React.ReactNode;
}

export function FeatureSection({
  headline,
  description,
  imageSrc,
  imageAlt,
  reverse = false,
  children
}: FeatureSectionProps) {
  return (
    <section className="py-14 px-6">
      <div className="max-w-7xl mx-auto">
        <div className={`grid lg:grid-cols-2 gap-10 items-center ${reverse ? 'lg:grid-flow-dense' : ''}`}>
          <div className={`space-y-5 ${reverse ? 'lg:col-start-2' : ''}`}>
            <h2 className="text-3xl lg:text-4xl font-bold tracking-tight">
              {headline}
            </h2>
            <p className="text-base text-gray-600 leading-relaxed">
              {description}
            </p>
          </div>

          <div className={reverse ? 'lg:col-start-1 lg:row-start-1' : ''}>
            {children || (
              <div className="relative rounded-xl overflow-hidden shadow-xl">
                <ImageWithFallback
                  src={imageSrc}
                  alt={imageAlt}
                  className="w-full h-[360px] object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
