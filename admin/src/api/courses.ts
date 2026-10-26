import { del, get, patch, post } from './client.ts';
import type { ReadOptions } from './client.ts';
import type { Course, CourseChanges, CourseInput, CoursePage } from './types.ts';

/** All the courses (there are few; the API takes 100 at a time). */
export const listCourses = (options?: ReadOptions) => get<CoursePage>('/courses?limit=100', options);

export const createCourse = (data: CourseInput) => post<Course>('/courses', data);

export const updateCourse = (id: string, changes: CourseChanges) => patch<Course>(`/courses/${id}`, changes);

export const deleteCourse = (id: string) => del(`/courses/${id}`);
