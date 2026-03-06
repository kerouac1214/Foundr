import React from 'react';
import { Sequence, useVideoConfig } from 'remotion';
import { Shot } from './Shot';
import { StoryboardItem } from '../types';

interface CompositionProps {
    storyboard: StoryboardItem[];
}

export const StoryboardComposition: React.FC<CompositionProps> = ({ storyboard }) => {
    const { fps } = useVideoConfig();

    let currentFrame = 0;

    return (
        <>
            {storyboard.map((item, index) => {
                const durationInFrames = Math.max(1, Math.round((item.duration || 3) * fps));
                const startFrom = currentFrame;
                currentFrame += durationInFrames;

                return (
                    <Sequence
                        key={item.id || index}
                        from={startFrom}
                        durationInFrames={durationInFrames}
                    >
                        <Shot
                            videoUrl={item.video_url}
                            imageUrl={item.preview_url}
                            durationInFrames={durationInFrames}
                        />
                    </Sequence>
                );
            })}
        </>
    );
};
