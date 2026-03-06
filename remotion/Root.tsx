import React from 'react';
import { Composition } from 'remotion';
import { StoryboardComposition } from './Composition';
import { StoryboardItem } from '../types';

interface RootProps {
    storyboard: StoryboardItem[];
    aspectRatio: '16:9' | '9:16' | '4:3' | '1:1';
}

export const RemotionRoot: React.FC<RootProps> = ({ storyboard, aspectRatio }) => {
    const fps = 30;

    // Calculate total duration
    const totalDurationInSeconds = storyboard.reduce((acc, item) => acc + (item.duration || 3), 0);
    const totalDurationInFrames = Math.max(1, Math.round(totalDurationInSeconds * fps));

    // Determine dimensions based on aspect ratio
    let width = 1920;
    let height = 1080;

    if (aspectRatio === '9:16') {
        width = 1080;
        height = 1920;
    } else if (aspectRatio === '4:3') {
        width = 1440;
        height = 1080;
    } else if (aspectRatio === '1:1') {
        width = 1080;
        height = 1080;
    }

    return (
        <>
            <Composition
                id="Storyboard"
                component={StoryboardComposition}
                durationInFrames={totalDurationInFrames}
                fps={fps}
                width={width}
                height={height}
                defaultProps={{
                    storyboard
                }}
            />
        </>
    );
};
