import { EmbeddedScene, SceneAppPage, SceneAppPageLike, SceneControlsSpacer, SceneFlexLayout, SceneRefreshPicker, SceneRouteMatch, SceneTimePicker, VariableValueSelectors } from "@grafana/scenes";
import { ROUTES } from "../../../constants";
import { prefixRoute } from "utils/utils.routing";
import { usePluginProps } from "utils/utils.plugin";
import { createTopLevelVariables, createTimeRange } from "../../../common/variableHelpers";

function getScene(daemonSet: string) {
    return new EmbeddedScene({
        controls: [
            new VariableValueSelectors({}),
            new SceneControlsSpacer(),
            new SceneTimePicker({ isOnCanvas: true }),
            new SceneRefreshPicker({
                intervals: ['5s', '1m', '1h'],
                isOnCanvas: true,
            }),
        ],
        body: new SceneFlexLayout({
            direction: 'column',
            children: []
        }),
    })
}

export function DaemonSetPage(routeMatch: SceneRouteMatch<any>, parent: SceneAppPageLike) {

    const props = usePluginProps();

    const variables = createTopLevelVariables({
        datasource: props?.meta.jsonData?.datasource || 'prometheus'
    })

    const timeRange = createTimeRange()

    return new SceneAppPage({
        title: `DaemonSet - ${routeMatch.params.name}`,
        titleIcon: 'dashboard',
        $variables: variables,
        $timeRange: timeRange,
        url: prefixRoute(`${ROUTES.Workloads}/daemonsets/${routeMatch.params.namespace}/${routeMatch.params.name}`),
        getScene: () => getScene(routeMatch.params.name),
        getParentPage: () => parent,
    })
}
