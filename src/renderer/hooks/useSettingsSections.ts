import type { ComponentType } from 'react'

export const useSettingsSections = <T extends ComponentType>(sections: T[]): T[] => sections
