import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useSprings, animated, easings } from '@react-spring/web';
import { EModelEndpoint } from 'librechat-data-provider';
import { BirthdayIcon, TooltipAnchor, SplitText } from '@librechat/client';
import { useChatContext, useAgentsMapContext, useAssistantsMapContext } from '~/Providers';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import ConvoIcon from '~/components/Endpoints/ConvoIcon';
import { useLocalize, useAuthContext } from '~/hooks';
import { getIconEndpoint, getEntity } from '~/utils';

interface StyledChar {
  char: string;
  isHighlight: boolean;
}

function StyledSplitText({
  text,
  className,
  highlightClassName,
  highlightPattern,
  delay = 50,
  animationFrom = { opacity: 0, transform: 'translate3d(0,50px,0)' },
  animationTo = { opacity: 1, transform: 'translate3d(0,0,0)' },
  easing,
  onLineCountChange,
}: {
  text: string;
  className: string;
  highlightClassName: string;
  highlightPattern: RegExp | null;
  delay?: number;
  animationFrom?: { opacity: number; transform: string };
  animationTo?: { opacity: number; transform: string };
  easing?: (t: number) => number;
  onLineCountChange?: (count: number) => void;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [inView, setInView] = useState(false);

  // Build styled characters array with highlight info
  const styledChars = useMemo((): StyledChar[] => {
    const result: StyledChar[] = [];
    let remaining = text;
    let lastIndex = 0;

    // If no pattern, return all chars as non-highlighted
    if (!highlightPattern) {
      for (const char of text) {
        result.push({ char, isHighlight: false });
      }
      return result;
    }

    // Reset regex
    highlightPattern.lastIndex = 0;
    let match;

    while ((match = highlightPattern.exec(text)) !== null) {
      // Add non-highlighted text before match
      const beforeMatch = text.slice(lastIndex, match.index);
      for (const char of beforeMatch) {
        result.push({ char, isHighlight: false });
      }
      // Add highlighted text
      for (const char of match[0]) {
        result.push({ char, isHighlight: true });
      }
      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    remaining = text.slice(lastIndex);
    for (const char of remaining) {
      result.push({ char, isHighlight: false });
    }

    return result;
  }, [text, highlightPattern]);

  // Split into words for proper wrapping
  const words = useMemo(() => {
    const wordList: { chars: StyledChar[]; hasSpace: boolean }[] = [];
    let currentWord: StyledChar[] = [];

    styledChars.forEach((sc) => {
      if (sc.char === ' ') {
        if (currentWord.length > 0) {
          wordList.push({ chars: currentWord, hasSpace: true });
          currentWord = [];
        }
      } else {
        currentWord.push(sc);
      }
    });

    if (currentWord.length > 0) {
      wordList.push({ chars: currentWord, hasSpace: false });
    }

    return wordList;
  }, [styledChars]);

  const totalChars = styledChars.filter((sc) => sc.char !== ' ').length;

  const [springs] = useSprings(
    totalChars,
    (i) => ({
      from: animationFrom,
      to: inView ? animationTo : animationFrom,
      delay: i * delay,
      config: { easing },
    }),
    [inView, text, delay, animationFrom, animationTo, easing],
  );

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          if (ref.current) {
            observer.unobserve(ref.current);
          }
        }
      },
      { threshold: 0, rootMargin: '0px' },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (ref.current && inView && onLineCountChange) {
      const element = ref.current;
      setTimeout(() => {
        const lineHeight =
          parseInt(getComputedStyle(element).lineHeight) ||
          parseInt(getComputedStyle(element).fontSize) * 1.2;
        const height = element.offsetHeight;
        const lines = Math.round(height / lineHeight);
        onLineCountChange(lines);
      }, 100);
    }
  }, [inView, text, onLineCountChange]);

  // Pre-calculate the starting index for each word
  const wordStartIndices = useMemo(() => {
    const indices: number[] = [];
    let runningIndex = 0;
    words.forEach((word) => {
      indices.push(runningIndex);
      runningIndex += word.chars.length;
    });
    return indices;
  }, [words]);

  return (
    <>
      <span className="sr-only">{text}</span>
      <p
        ref={ref}
        className={`split-parent inline overflow-hidden ${className}`}
        style={{ textAlign: 'center', whiteSpace: 'normal', wordWrap: 'break-word' }}
        aria-hidden="true"
      >
        {words.map((word, wordIndex) => (
          <span key={wordIndex} style={{ display: 'inline', whiteSpace: 'nowrap' }}>
            {word.chars.map((sc, letterIndex) => {
              const springIndex = wordStartIndices[wordIndex] + letterIndex;
              return (
                <animated.span
                  key={`${wordIndex}-${letterIndex}`}
                  style={springs[springIndex]}
                  className={`inline-block transform transition-opacity will-change-transform ${sc.isHighlight ? highlightClassName : ''}`}
                >
                  {sc.char}
                </animated.span>
              );
            })}
            {wordIndex < words.length - 1 && ' '}
          </span>
        ))}
      </p>
    </>
  );
}

const containerClassName =
  'shadow-stroke relative flex h-full items-center justify-center rounded-full bg-white dark:bg-presentation dark:text-white text-black dark:after:shadow-none ';

function getTextSizeClass(text: string | undefined | null) {
  if (!text) {
    return 'text-xl sm:text-2xl';
  }

  if (text.length < 40) {
    return 'text-2xl sm:text-4xl';
  }

  if (text.length < 70) {
    return 'text-xl sm:text-2xl';
  }

  return 'text-lg sm:text-md';
}

export default function Landing({ centerFormOnLanding }: { centerFormOnLanding: boolean }) {
  const { conversation } = useChatContext();
  const agentsMap = useAgentsMapContext();
  const assistantMap = useAssistantsMapContext();
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig } = useGetEndpointsQuery();
  const { user } = useAuthContext();
  const localize = useLocalize();

  const [textHasMultipleLines, setTextHasMultipleLines] = useState(false);
  const [lineCount, setLineCount] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const endpointType = useMemo(() => {
    let ep = conversation?.endpoint ?? '';
    if (
      [
        EModelEndpoint.chatGPTBrowser,
        EModelEndpoint.azureOpenAI,
        EModelEndpoint.gptPlugins,
      ].includes(ep as EModelEndpoint)
    ) {
      ep = EModelEndpoint.openAI;
    }
    return getIconEndpoint({
      endpointsConfig,
      iconURL: conversation?.iconURL,
      endpoint: ep,
    });
  }, [conversation?.endpoint, conversation?.iconURL, endpointsConfig]);

  const { entity, isAgent, isAssistant } = getEntity({
    endpoint: endpointType,
    agentsMap,
    assistantMap,
    agent_id: conversation?.agent_id,
    assistant_id: conversation?.assistant_id,
  });

  const name = entity?.name ?? '';
  const description = (entity?.description || conversation?.greeting) ?? '';

  const getGreeting = useCallback(() => {
    if (typeof startupConfig?.interface?.customWelcome === 'string') {
      const customWelcome = startupConfig.interface.customWelcome;
      // Replace {{user.name}} with actual user name if available
      if (user?.name && customWelcome.includes('{{user.name}}')) {
        return customWelcome.replace(/{{user.name}}/g, user.name);
      }
      return customWelcome;
    }

    const now = new Date();
    const hours = now.getHours();

    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Early morning (midnight to 4:59 AM)
    if (hours >= 0 && hours < 5) {
      return localize('com_ui_late_night');
    }
    // Morning (6 AM to 11:59 AM)
    else if (hours < 12) {
      if (isWeekend) {
        return localize('com_ui_weekend_morning');
      }
      return localize('com_ui_good_morning');
    }
    // Afternoon (12 PM to 4:59 PM)
    else if (hours < 17) {
      return localize('com_ui_good_afternoon');
    }
    // Evening (5 PM to 8:59 PM)
    else {
      return localize('com_ui_good_evening');
    }
  }, [localize, startupConfig?.interface?.customWelcome, user?.name]);

  const handleLineCountChange = useCallback((count: number) => {
    setTextHasMultipleLines(count > 1);
    setLineCount(count);
  }, []);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.offsetHeight);
    }
  }, [lineCount, description]);

  const getDynamicMargin = useMemo(() => {
    let margin = 'mb-0';

    if (lineCount > 2 || (description && description.length > 100)) {
      margin = 'mb-10';
    } else if (lineCount > 1 || (description && description.length > 0)) {
      margin = 'mb-6';
    } else if (textHasMultipleLines) {
      margin = 'mb-4';
    }

    if (contentHeight > 200) {
      margin = 'mb-16';
    } else if (contentHeight > 150) {
      margin = 'mb-12';
    }

    return margin;
  }, [lineCount, description, textHasMultipleLines, contentHeight]);

  const greetingText =
    typeof startupConfig?.interface?.customWelcome === 'string'
      ? getGreeting()
      : getGreeting() + (user?.name ? ', ' + user.name : '');

  const appName = startupConfig?.interface?.appName;
  const highlightPattern = useMemo(
    () => (appName ? new RegExp(`(${appName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null),
    [appName],
  );

  return (
    <div
      className={`flex h-full transform-gpu flex-col items-center justify-center pb-8 transition-all duration-200 ${centerFormOnLanding ? 'max-h-full sm:max-h-0' : 'max-h-full'} ${getDynamicMargin}`}
    >
      <div ref={contentRef} className="flex flex-col items-center gap-0 p-2">
        <div
          className={`flex ${textHasMultipleLines ? 'flex-col' : 'flex-col md:flex-row'} items-center justify-center gap-2`}
        >
          <div className={`relative size-10 justify-center ${textHasMultipleLines ? 'mb-2' : ''}`}>
            <ConvoIcon
              agentsMap={agentsMap}
              assistantMap={assistantMap}
              conversation={conversation}
              endpointsConfig={endpointsConfig}
              containerClassName={containerClassName}
              context="landing"
              className="h-2/3 w-2/3 text-black dark:text-white"
              size={41}
            />
            {startupConfig?.showBirthdayIcon && (
              <TooltipAnchor
                className="absolute bottom-[27px] right-2"
                description={localize('com_ui_happy_birthday')}
              >
                <BirthdayIcon />
              </TooltipAnchor>
            )}
          </div>
          {((isAgent || isAssistant) && name) || name ? (
            <div className="flex flex-col items-center gap-0 p-2">
              <SplitText
                key={`split-text-${name}`}
                text={name}
                className={`${getTextSizeClass(name)} font-medium text-text-primary`}
                delay={50}
                textAlign="center"
                animationFrom={{ opacity: 0, transform: 'translate3d(0,50px,0)' }}
                animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
                easing={easings.easeOutCubic}
                threshold={0}
                rootMargin="0px"
                onLineCountChange={handleLineCountChange}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-center">
              <StyledSplitText
                key={`styled-split-text-${greetingText}`}
                text={greetingText}
                className={`${getTextSizeClass(greetingText)} font-medium text-text-primary`}
                highlightClassName="text-green-500"
                highlightPattern={highlightPattern}
                delay={50}
                animationFrom={{ opacity: 0, transform: 'translate3d(0,50px,0)' }}
                animationTo={{ opacity: 1, transform: 'translate3d(0,0,0)' }}
                easing={easings.easeOutCubic}
                onLineCountChange={handleLineCountChange}
              />
            </div>
          )}
        </div>
        {description && (
          <div className="animate-fadeIn mt-4 max-w-md text-center text-sm font-normal text-text-primary">
            {description}
          </div>
        )}
      </div>
    </div>
  );
}
