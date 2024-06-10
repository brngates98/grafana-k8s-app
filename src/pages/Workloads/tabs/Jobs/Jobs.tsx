import { 
    EmbeddedScene, 
    sceneGraph, 
    SceneFlexLayout, 
    SceneFlexItem, 
    SceneQueryRunner,
    SceneObject,
    SceneObjectState,
    SceneObjectBase,
    SceneComponentProps,
    TextBoxVariable,
    SceneVariableSet,
    VariableValueSelectors,
} from '@grafana/scenes';
import React, { useEffect, useMemo } from 'react';
import { DataFrameView } from '@grafana/data';
import { InteractiveTable } from '../../../../components/InteractiveTable/InterativeTable';
import { asyncQueryRunner } from 'common/queryHelpers';
import { getSeries } from 'common/seriesHelpers';
import { createNamespaceVariable, resolveVariable } from 'common/variableHelpers';
import { createRowQueries } from './Queries';
import { CellContext } from '@tanstack/react-table';
import { Metrics } from 'metrics/metrics';
import { LinkCell } from 'components/Cell/LinkCell';

const namespaceVariable = createNamespaceVariable();

const searchVariable = new TextBoxVariable({
    name: 'search',
    label: 'Search',
    value: '',
});

const jobsQueryRunner = new SceneQueryRunner({
    datasource: {
        uid: '$datasource',
        type: 'prometheus',
    },
    queries: [
        {
            refId: 'jobs',
            expr: `
                ${Metrics.kubeJobInfo.name}{
                    cluster="$cluster",
                    ${Metrics.kubeJobInfo.labels.namespace}=~"$namespace",
                    ${Metrics.kubeJobInfo.labels.jobName}=~".*$search.*"
                }`,
            instant: true,
            format: 'table'
        },
    ], 
})

interface ExpandedRowProps {
    tableViz: TableViz;
    row: TableRow;
}

function ExpandedRow({ tableViz, row }: ExpandedRowProps) {
    const { expandedRows } = tableViz.useState();
  
    const rowScene = expandedRows?.find((scene) => scene.state.key === row.job_name);
  
    useEffect(() => {
      if (!rowScene) {
        // const newRowScene = buildExpandedRowScene(row.pod);
        // tableViz.setState({ expandedRows: [...(tableViz.state.expandedRows ?? []), newRowScene] });
      }
    }, [row, tableViz, rowScene]);
  
    return rowScene ? <rowScene.Component model={rowScene} /> : null;
}

interface TableRow {
    cluster: string;
    job_name: string;
    namespace: string;
    complete: boolean;
    owner: {
        kind: string;
        name: string;
    };
}

interface TableVizState extends SceneObjectState {
    expandedRows?: SceneObject[];
    asyncRowData?: Map<string, number[]>;
    visibleRowIds?: string;
}

class TableViz extends SceneObjectBase<TableVizState> {

    constructor(state: TableVizState) {
        super({ ...state, asyncRowData: new Map<string, number[]>() });
    }

    private setAsyncRowData(data: any) {
        this.setState({ ...this.state, asyncRowData: data });
    }

    private setVisibleRowIds(ids: string) {
        this.setState({ ...this.state, visibleRowIds: ids });
    }

    static Component = (props: SceneComponentProps<TableViz>) => {
        const { data } = sceneGraph.getData(props.model).useState();
        const sceneVariables = sceneGraph.getVariables(props.model)
        const timeRange = sceneGraph.getTimeRange(props.model)
        const { asyncRowData } = props.model.useState();
        const { visibleRowIds } = props.model.useState();
       
        const columns = useMemo(
            () => [
                { id: 'job_name', header: 'JOB', cell: (props: CellContext<TableRow, any>) => LinkCell('jobs', props.row.original.job_name) },
                { id: 'namespace', header: 'NAMESPACE' },
                { id: 'owner', header: 'OWNER', cell: (props: CellContext<TableRow, any>) => (<span>{props.row.original.owner.kind} - {props.row.original.owner.name}</span>) },
                { id: 'complete', header: 'COMPLETE', cell: (props: CellContext<TableRow, any>) => (<span>{props.row.original.complete ? 'Yes' : 'No'}</span>) },
            ],
            []
        );

        const tableData = useMemo(() => {
            if (!data || data.series.length === 0) {
                return [];
            }

            const frame = data.series[0];
            const view = new DataFrameView<TableRow>(frame);
            const rows = view.toArray();

            const serieMatcherPredicate = (row: TableRow) => (value: any) => value.job_name === row.job_name;

            for (const row of rows) {

                const complete = getSeries(asyncRowData, 'completed', serieMatcherPredicate(row))
                row.complete = complete?.[`Value #completed`]

                const owner = getSeries(asyncRowData, 'owner', serieMatcherPredicate(row))

                row.owner = {
                    kind: owner?.owner_kind,
                    name: owner?.owner_name,
                }
            }
            
            return rows;
        }, [data, asyncRowData]);

        const onRowsChanged = (rows: any) => {
            const ids = rows.map((row: any) => row.id).join('|');
            
            if (!ids || ids.length === 0 || visibleRowIds === ids) {
                return;
            }

            const datasource = resolveVariable(sceneVariables, 'datasource')

            asyncQueryRunner({
                datasource: {
                    uid: datasource?.toString(),
                    type: 'prometheus',
                },
                
                queries: [
                    ...createRowQueries(ids, sceneVariables),
                ],
                $timeRange: timeRange.clone(),
            }).then((data) => {
                props.model.setVisibleRowIds(ids);
                props.model.setAsyncRowData(data);
            });
        };

        return (
            <InteractiveTable
                columns={columns}
                getRowId={(row: any) => row.job_name}
                data={tableData}
                renderExpandedRow={(row) => <ExpandedRow tableViz={props.model} row={row} />}
                pageSize={10}
                onRowsChanged={onRowsChanged}
            />
        );
    };
}

export const getJobsScene = () => {
    return new EmbeddedScene({
        $variables: new SceneVariableSet({
            variables: [namespaceVariable, searchVariable],
        }),
        controls: [
            new VariableValueSelectors({})
        ],
        body: new SceneFlexLayout({
            children: [
                new SceneFlexItem({
                    width: '100%',
                    height: '100%',
                    body: new TableViz({
                        $data: jobsQueryRunner,
                    }),
                }),
            ],
        }),
    })
}
