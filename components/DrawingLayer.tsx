import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path, Circle, Defs, Filter, FeGaussianBlur, LinearGradient, Stop } from 'react-native-svg';
import Animated, { useAnimatedProps, SharedValue } from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface DrawingLayerProps {
  path: SharedValue<string>;
  startX?: SharedValue<number>;
  startY?: SharedValue<number>;
  currentX?: SharedValue<number>;
  currentY?: SharedValue<number>;
  color?: string;
  strokeWidth?: number;
  gradientStart?: string;
  gradientEnd?: string;
}

export function DrawingLayer({ 
  path, 
  startX, 
  startY, 
  currentX, 
  currentY,
  color = '#38bdf8', 
  strokeWidth = 8,
  gradientStart = '#576ffb',
  gradientEnd = '#f865c4',
}: DrawingLayerProps) {
  const animatedPathProps = useAnimatedProps(() => {
    return {
      d: path.value,
    };
  });

  const animatedStartCircleProps = useAnimatedProps(() => {
    return {
      cx: startX?.value ?? 0,
      cy: startY?.value ?? 0,
    };
  });

  const animatedEndCircleProps = useAnimatedProps(() => {
    return {
      cx: currentX?.value ?? 0,
      cy: currentY?.value ?? 0,
    };
  });

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
      <Svg style={StyleSheet.absoluteFill}>
        <Defs>
          <Filter id="glow">
            <FeGaussianBlur stdDeviation="3" result="coloredBlur" />
          </Filter>
          <LinearGradient 
            id="lineGradient" 
            x1="0%" 
            y1="0%" 
            x2="100%" 
            y2="100%"
          >
            <Stop offset="0%" stopColor={gradientStart} stopOpacity="1" />
            <Stop offset="100%" stopColor={gradientEnd} stopOpacity="1" />
          </LinearGradient>
        </Defs>
        
        {/* Glow Effect (Background) */}
        <AnimatedPath
          animatedProps={animatedPathProps}
          stroke="url(#lineGradient)"
          strokeWidth={strokeWidth + 8}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.3"
          filter="url(#glow)"
        />
        
        {/* Main Line */}
        <AnimatedPath
          animatedProps={animatedPathProps}
          stroke="url(#lineGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="1"
        />
        
        {/* Start Circle */}
        <AnimatedCircle
          animatedProps={animatedStartCircleProps}
          r="8"
          fill={gradientStart}
          opacity="1"
        />
        
        {/* End Circle (Transparent, larger) */}
        <AnimatedCircle
          animatedProps={animatedEndCircleProps}
          r="20"
          fill={gradientEnd}
          opacity="0.2"
        />
      </Svg>
    </View>
  );
}
