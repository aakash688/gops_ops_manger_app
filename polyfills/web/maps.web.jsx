import React from 'react';
import { View } from 'react-native';

export const PROVIDER_DEFAULT = undefined;

const MapView = React.forwardRef((props, ref) => {
  const { style, children } = props;
  return <View ref={ref} style={style}>{children}</View>;
});

const MapChild = ({ children }) => children ?? null;

Object.assign(MapView, { PROVIDER_DEFAULT });

export const Marker = MapChild;
export const Callout = MapChild;
export const Polyline = MapChild;
export const Polygon = MapChild;
export const Circle = MapChild;
export const Overlay = MapChild;
export const Heatmap = MapChild;
export const UrlTile = MapChild;
export const WMSTile = MapChild;
export const LocalTile = MapChild;

export default MapView;
