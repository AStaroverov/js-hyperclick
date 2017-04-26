"use babel"
// @flow
/* eslint-env jasmine */
import path from 'path'

import extractAnnotations from './utils/extract-annotations'
import findLocation from './utils/find-location'
import { parseCode, buildSuggestion, resolveModule, findDestination } from '../lib/core'

const buildExpectations = (srcFilename) => function()  {
    const spec = this
    const { code, annotations } = extractAnnotations('all-imports.js')
    const info = parseCode(code)
    const runner = (name) => {
        if (annotations[name]) {
            const { text, start, end } = annotations[name]
            return buildSuggestion(info, text, { start, end })
        }
    }
    spec.addMatchers({
        toLinkToExternalModuleLocation(endAnnotation) {
            const startAnnotation = this.actual
            const suggestion = runner(startAnnotation)

            let actual
            let annotations = {}
            if (suggestion != null && suggestion.type === 'from-import') {
                const resolved = resolveModule(srcFilename, suggestion)

                if (typeof resolved.filename !== 'undefined') {
                    const tmp = extractAnnotations(resolved.filename)
                    const info = parseCode(tmp.code)
                    annotations = tmp.annotations

                    actual = findDestination(info, suggestion)
                }
            }

            const expected = annotations[endAnnotation]

            const pass = (
                suggestion != null
                && expected != null
                && actual != null
                && actual.start === expected.start
                // && actual.moduleName === moduleName
                // && actual.imported === imported
            )

            const message = () => {
                let str = (pass
                    ? this.utils.matcherHint('.not.toLinkToExternalModuleLocation', startAnnotation, endAnnotation)
                    : this.utils.matcherHint('.toLinkToExternalModuleLocation', startAnnotation, endAnnotation)
                ) + "\n\n"

                if (!expected || expected.start == null) {
                    str += `Annotation ${this.utils.EXPECTED_COLOR(endAnnotation)} not found\n`
                } else {
                    str += `Expected ${pass ? 'not ' : ''}to jump to:\n`
                    str += `${this.utils.EXPECTED_COLOR(findLocation(code, expected.start))}\n`
                }

                if (actual == null) {
                    str += `Annotation ${this.utils.RECEIVED_COLOR(startAnnotation)} not found\n`
                } else if (!pass) {
                    str += `Actually jumped to:\n`
                    str += `${this.utils.RECEIVED_COLOR(findLocation(code, actual.start))}\n`
                }

                return str
            }

            return { pass, message }
        },
    })
}

describe(`findDestination (all-imports.js)`, () => {
    const srcFilename = path.join(__dirname, 'fixtures/all-imports.js')
    beforeEach(buildExpectations(srcFilename))

    it('default import links to the default export', () => {
        expect('someModule').toLinkToExternalModuleLocation('defaultExport')
    })

    it(`named import links to the named export`, () => {
        expect('namedExportFrom').toLinkToExternalModuleLocation('namedExportFrom')
        expect('name1').toLinkToExternalModuleLocation('name1')
        expect('name2').toLinkToExternalModuleLocation('name2')
        expect('name3').toLinkToExternalModuleLocation('name3')
        expect('name4').toLinkToExternalModuleLocation('name4')
    })

    it('missingExport will go to the default export', () => {
        expect('missingExport').toLinkToExternalModuleLocation('defaultExport')
    })

    it(`throws when you give it a bad suggestion object`, () => {
        const suggestion = {}
        const info = {}

        expect(() => {
            // $FlowExpectError
            findDestination(info, suggestion)
        }).toThrow('Invalid suggestion type')

    })
})