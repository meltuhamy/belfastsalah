import SwiftUI

/**
 * Lets a test find out whether any text in a widget was cut off.
 *
 * SwiftUI shortens a line that does not fit with "…" and says nothing, which
 * is the iOS form of the clipping WidgetFitTest catches on Android. With
 * `\.fitProbing` on, each probed text reports two widths: the one it was
 * given, and the one it would take unconstrained - measured from a hidden
 * copy that ignores the space on offer. A text whose natural width is more
 * than it got has been cut.
 *
 * Off, which is how WidgetKit always draws it, the modifier adds nothing.
 */
struct FitMeasurement: Equatable {
    var given: CGFloat = 0
    var natural: CGFloat = 0
    /**
     * The smallest scale the text may shrink to (its minimumScaleFactor), so
     * the natural width it actually needs is `natural * minimumScale`. 1 for
     * text that may not shrink, where any shortfall is a cut.
     */
    var minimumScale: CGFloat = 1

    var isCutOff: Bool { natural * minimumScale > given + 0.5 }
}

struct FitPreferenceKey: PreferenceKey {
    static let defaultValue: [String: FitMeasurement] = [:]

    static func reduce(value: inout [String: FitMeasurement], nextValue: () -> [String: FitMeasurement]) {
        value.merge(nextValue()) { current, next in
            FitMeasurement(
                given: max(current.given, next.given),
                natural: max(current.natural, next.natural),
                minimumScale: min(current.minimumScale, next.minimumScale)
            )
        }
    }
}

private struct FitProbingKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var fitProbing: Bool {
        get { self[FitProbingKey.self] }
        set { self[FitProbingKey.self] = newValue }
    }
}

private struct FitProbe: ViewModifier {
    let id: String
    let minimumScale: CGFloat
    @Environment(\.fitProbing) private var probing

    func body(content: Content) -> some View {
        if probing {
            content
                .background(GeometryReader { proxy in
                    Color.clear.preference(
                        key: FitPreferenceKey.self,
                        value: [id: FitMeasurement(given: proxy.size.width, minimumScale: minimumScale)]
                    )
                })
                .overlay(alignment: .leading) {
                    content
                        .fixedSize()
                        .hidden()
                        .background(GeometryReader { proxy in
                            Color.clear.preference(
                                key: FitPreferenceKey.self,
                                value: [id: FitMeasurement(natural: proxy.size.width)]
                            )
                        })
                }
        } else {
            content
        }
    }
}

extension View {
    /** Names a text for the fit tests. See FitProbe. */
    func fitProbe(_ id: String) -> some View {
        modifier(FitProbe(id: id, minimumScale: 1))
    }

    /**
     * A text allowed to shrink to `minimumScale` of its size rather than be
     * cut, and probed knowing it: it only counts as cut off if it would have
     * to shrink further than that.
     */
    func shrinkable(_ id: String, minimumScale: CGFloat) -> some View {
        modifier(FitProbe(id: id, minimumScale: minimumScale))
            .minimumScaleFactor(minimumScale)
    }
}
