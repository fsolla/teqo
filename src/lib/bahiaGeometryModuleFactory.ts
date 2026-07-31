import { feature } from 'topojson-client'

import type { BahiaFeature } from '@/lib/bahiaGeometriesTypes'
import type { GeometryCollection, Topology } from 'topojson-specification'

type GeometryModuleBase<
  Properties extends Record<string, unknown>,
  TObjectName extends string,
> = {
  topology: Topology<{ [key in TObjectName]: GeometryCollection<Properties> }>
  features: readonly BahiaFeature<Properties>[]
}

type IndexedGeometryModule<
  Properties extends Record<string, unknown>,
  TObjectName extends string,
  KeyProperty extends keyof Properties & string,
> = GeometryModuleBase<Properties, TObjectName> & {
  getFeatureByKey: (key: Properties[KeyProperty]) => BahiaFeature<Properties> | undefined
}

type BuildGeometryModuleOptions<
  Properties extends Record<string, unknown>,
  TObjectName extends string,
  KeyProperty extends keyof Properties & string,
> = {
  topology: Topology<{ [key in TObjectName]: GeometryCollection<Properties> }>
  objectName: TObjectName
  keyProperty?: KeyProperty
}

export function buildGeometryModuleFromTopology<
  Properties extends Record<string, unknown>,
  TObjectName extends string,
  KeyProperty extends keyof Properties & string,
>(
  options: BuildGeometryModuleOptions<Properties, TObjectName, KeyProperty> & {
    keyProperty: KeyProperty
  },
): IndexedGeometryModule<Properties, TObjectName, KeyProperty>

export function buildGeometryModuleFromTopology<
  Properties extends Record<string, unknown>,
  TObjectName extends string,
>(
  options: BuildGeometryModuleOptions<Properties, TObjectName, never>,
): GeometryModuleBase<Properties, TObjectName>

export function buildGeometryModuleFromTopology<
  Properties extends Record<string, unknown>,
  TObjectName extends string,
  KeyProperty extends keyof Properties & string,
>({
  topology,
  objectName,
  keyProperty,
}: BuildGeometryModuleOptions<Properties, TObjectName, KeyProperty>):
  | GeometryModuleBase<Properties, TObjectName>
  | IndexedGeometryModule<Properties, TObjectName, KeyProperty> {
  const features = feature(topology, topology.objects[objectName])
    .features as BahiaFeature<Properties>[]

  const base: GeometryModuleBase<Properties, TObjectName> = {
    topology,
    features,
  }

  if (!keyProperty) {
    return base
  }

  const featuresByKey = new Map(
    features.map((entry) => [entry.properties[keyProperty], entry]),
  )

  return {
    ...base,
    getFeatureByKey: (key) => featuresByKey.get(key),
  }
}
