import React from 'react';
import { AbsoluteFill, Video, Img, useVideoConfig } from 'remotion';

interface ShotProps {
    videoUrl?: string;
    imageUrl?: string;
    durationInFrames: number;
}

export const Shot: React.FC<ShotProps> = ({ videoUrl, imageUrl, durationInFrames }) => {
    const { width, height } = useVideoConfig();

    return (
        <AbsoluteFill style={{ backgroundColor: 'black' }}>
            {videoUrl ? (
                <Video
                    src={videoUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            ) : imageUrl ? (
                <Img
                    src={imageUrl}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                    }}
                />
            ) : (
                <div style={placeholderStyle}>
                    NO MEDIA
                </div>
            )}
        </AbsoluteFill>
    );
};

const placeholderStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#333',
    fontSize: 40,
    fontWeight: 'bold'
};
